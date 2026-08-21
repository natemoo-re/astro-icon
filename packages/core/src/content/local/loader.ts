import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegrationLogger } from "astro";
import type { Loader, LoaderContext } from "astro/loaders";
import { AstroIconError } from "../../internal/error.js";
import { formatDuration } from "../duration.js";
import { iconEntrySchema } from "../entrySchema.js";
import { listIconsOrFallback } from "../listIconsOrFallback.js";
import { isUpToDate, recordVersionKey } from "../syncFreshness.js";
import { recordCollection } from "../typegen/index.js";
import { looksLikeItNeedsCurrentColor } from "./currentColorHint.js";
import { localSource } from "./source.js";
import type { LocalSourceOptions } from "./source.js";

/**
 * A one-time, best-effort nudge (never a mutation - see the "Styling icons" README section for
 * why astro-icon doesn't rewrite colors automatically) toward the `svgo()` currentColor recipe,
 * logged when local icons look like they won't respond to CSS `color`.
 */
function warnAboutMissingCurrentColor(
  store: Pick<LoaderContext["store"], "values">,
  collection: string,
  logger: Pick<AstroIntegrationLogger, "warn">,
): void {
  const candidates = [...store.values()].filter((entry) =>
    looksLikeItNeedsCurrentColor(entry.data.body as string),
  );
  if (candidates.length === 0) return;

  logger.warn(
    `${candidates.length} icon(s) in "${collection}" don't appear to use "currentColor" and won't respond to CSS \`color\`. See the "Styling icons" section of the README, or pass \`optimize: svgo({ plugins: [{ name: "preset-default", params: { overrides: { convertColors: { currentColor: true } } } }] })\` from "astro-icon/optimize" to convert them.`,
  );
}

/** Cheap (no SVGO) fingerprint of a file's raw contents, to detect whether it actually changed. */
function hashSource(raw: string): string {
  return createHash("sha1").update(raw).digest("hex");
}

/**
 * Cheap fingerprint of the whole directory: `mtime` + `size` per file
 * (via `stat`, not a content read) so an unchanged sync can be detected
 * without reading (let alone re-optimizing) a single `.svg`.
 */
async function getDirVersionKey(
  dirPath: string,
  names: string[],
): Promise<string> {
  const entries = await Promise.all(
    names
      .slice()
      .sort()
      .map(async (id) => {
        try {
          const info = await stat(join(dirPath, `${id}.svg`));
          return `${id}:${info.mtimeMs}:${info.size}`;
        } catch {
          return `${id}:missing`;
        }
      }),
  );
  return createHash("sha1").update(entries.join(",")).digest("hex");
}

/**
 * The subset of Astro's `LoaderContext` this loader actually reads. Exported so a test fixture
 * only has to implement these methods, not Astro's full real interfaces for `store`, `meta`,
 * `config`, and `watcher`.
 */
export interface LocalIconsSyncContext {
  store: Pick<
    LoaderContext["store"],
    "clear" | "set" | "get" | "entries" | "values" | "keys" | "delete" | "has"
  >;
  meta: Pick<LoaderContext["meta"], "get" | "set" | "delete" | "has">;
  logger: Pick<LoaderContext["logger"], "warn" | "info" | "error" | "debug">;
  parseData: LoaderContext["parseData"];
  generateDigest: LoaderContext["generateDigest"];
  config: Pick<LoaderContext["config"], "root">;
  watcher?: {
    on(event: string, listener: (...args: any[]) => void): void;
    add(paths: string | readonly string[]): void;
  };
  collection: LoaderContext["collection"];
}

/**
 * A content layer loader for a directory of local `.svg` files, the
 * suggested default for the `icons` collection:
 *
 * ```ts
 * icons: defineCollection({ loader: localIcons() }),
 * ```
 *
 * Each file's path relative to `dir` (without its extension, subdirectories
 * joined with `/`) becomes its icon name: `src/icons/logos/deno.svg` is
 * `"logos/deno"`.
 *
 * Watches the directory in dev the same way Astro's own file-backed loaders
 * do: add, edit, or remove an `.svg` file and the collection picks it up
 * without a dev server restart.
 */
export function localIcons(
  dir: string = "src/icons",
  options: LocalSourceOptions = {},
): Loader & { load: (context: LocalIconsSyncContext) => Promise<void> } {
  return {
    name: "astro-icon/loaders",
    schema: iconEntrySchema,
    load: syncLocalIcons(dir, options),
  };
}

/** Everything one file's sync (initial or watched) needs, bundled so it can be passed to a standalone function instead of captured by closure. */
interface FileSyncDeps {
  dirPath: string;
  source: ReturnType<typeof localSource>;
  strict: boolean;
  store: LocalIconsSyncContext["store"];
  meta: LocalIconsSyncContext["meta"];
  logger: LocalIconsSyncContext["logger"];
  parseData: LocalIconsSyncContext["parseData"];
  generateDigest: LocalIconsSyncContext["generateDigest"];
  config: LocalIconsSyncContext["config"];
  collection: LocalIconsSyncContext["collection"];
}

function idFromPath(dirPath: string, filePath: string): string | undefined {
  if (!filePath.startsWith(dirPath) || !filePath.endsWith(".svg"))
    return undefined;
  return filePath
    .slice(dirPath.length)
    .replace(/\\/g, "/")
    .replace(/^\//, "")
    .slice(0, -".svg".length);
}

/** Skips re-running `optimize`/SVGO if the source file's hash matches `previous`'s. */
async function syncIcon(
  deps: FileSyncDeps,
  id: string,
  previous?: ReturnType<LocalIconsSyncContext["store"]["get"]>,
): Promise<void> {
  const {
    dirPath,
    source,
    strict,
    store,
    meta,
    parseData,
    generateDigest,
    logger,
  } = deps;
  try {
    const filePath = join(dirPath, `${id}.svg`);
    let raw: string | undefined;
    try {
      raw = await readFile(filePath, "utf-8");
    } catch {
      // Falls through to source.getIcon()'s "no local icon file found" error.
    }

    if (raw !== undefined) {
      const sourceHash = hashSource(raw);
      const sourceHashKey = `sourceHash:${id}`;
      if (previous && meta.get(sourceHashKey) === sourceHash) {
        store.set({ id, data: previous.data, digest: previous.digest });
        return;
      }
      const data = await source.getIcon(id);
      const parsedData = await parseData({ id, data });
      meta.set(sourceHashKey, sourceHash);
      store.set({ id, data: parsedData, digest: generateDigest(parsedData) });
      return;
    }

    const data = await source.getIcon(id);
    const parsedData = await parseData({ id, data });
    store.set({ id, data: parsedData, digest: generateDigest(parsedData) });
  } catch (ex) {
    const detail = ex instanceof Error ? ex.message : String(ex);
    if (strict) {
      throw new AstroIconError(
        `Failed to build local icon "${id}": ${detail}`,
        `Fix the error above, or disable "strict" to skip this icon with a warning instead.`,
      );
    }
    logger.warn(`Failed to build local icon "${id}": ${detail}`);
  }
}

async function updateTypes(deps: FileSyncDeps): Promise<void> {
  await recordCollection(deps.config.root, "build", deps.collection, [
    ...deps.store.keys(),
  ]);
}

/**
 * Handles one chokidar event (`add`/`change`/`unlink`) for a file inside the watched directory,
 * exported so a test can call it directly with a fake `filePath` instead of driving a fake
 * watcher through `.on()`/`.emit()`. Ignores any path outside `deps.dirPath` or not a `.svg` file.
 */
export async function handleFileEvent(
  kind: "add" | "change" | "unlink",
  filePath: string,
  deps: FileSyncDeps,
): Promise<void> {
  const id = idFromPath(deps.dirPath, filePath);
  if (!id) return;

  switch (kind) {
    case "add":
      await syncIcon(deps, id, deps.store.get(id));
      await updateTypes(deps);
      deps.logger.info(`Added local icon "${id}"`);
      return;
    case "change":
      await syncIcon(deps, id, deps.store.get(id));
      deps.logger.info(`Reloaded local icon "${id}"`);
      return;
    case "unlink":
      deps.store.delete(id);
      deps.meta.delete(`sourceHash:${id}`);
      await updateTypes(deps);
      deps.logger.info(`Removed local icon "${id}"`);
      return;
  }
}

/**
 * The sync logic behind `localIcons`, taking only {@link LocalIconsSyncContext} instead of
 * Astro's full `LoaderContext` - keeping this signature (rather than `LoaderContext`) lets a test
 * fixture implement only the fields it actually needs, by calling the loader's own `.load()`.
 */
function syncLocalIcons(
  dir: string,
  options: LocalSourceOptions,
): (context: LocalIconsSyncContext) => Promise<void> {
  const strict = options.strict ?? false;

  return async (context) => {
    const {
      store,
      meta,
      logger,
      parseData,
      generateDigest,
      config,
      watcher,
      collection,
    } = context;

    const dirUrl = new URL(dir.replace(/\/?$/, "/"), config.root);
    const dirPath = fileURLToPath(dirUrl);
    const source = localSource(dirUrl, { ...options, logger });
    const deps: FileSyncDeps = {
      dirPath,
      source,
      strict,
      store,
      meta,
      logger,
      parseData,
      generateDigest,
      config,
      collection,
    };

    if (!existsSync(dirPath)) {
      logger.warn(
        `The local icon directory "${dirPath}" does not exist. Create it, or point "localIcons()" at a different "dir".`,
      );
    }

    const syncStart = performance.now();

    const names = await listIconsOrFallback(source, {
      strict,
      logger,
      failureMessage: (detail) =>
        `Failed to list local icons in "${dirPath}": ${detail}`,
      hint: `Fix the error above, or disable "strict" to skip local icons with a warning instead.`,
    });

    // Skip re-reading/re-optimizing every file if the directory's mtime+size
    // fingerprint matches the last sync - cheap to check via `stat`, unlike
    // the per-file content hash `syncIcon` uses once it's already reading a file.
    const metaKey = `astro-icon:version:${collection}`;
    const versionKey = await getDirVersionKey(dirPath, names);
    if (isUpToDate(versionKey, metaKey, meta, names, store)) {
      await updateTypes(deps);
      logger.debug(
        `"${collection}" is already up to date (${names.length} icon(s)), skipped in ${formatDuration(performance.now() - syncStart)}.`,
      );
    } else {
      // Snapshot before clearing so syncIcon can skip unchanged icons.
      const previousEntries = new Map(store.entries());
      store.clear();
      for (const id of names) {
        await syncIcon(deps, id, previousEntries.get(id));
      }
      await updateTypes(deps);
      recordVersionKey(meta, metaKey, versionKey);

      logger.info(
        `Loaded ${names.length} icon(s) from "${collection}" in ${formatDuration(performance.now() - syncStart)}.`,
      );
      warnAboutMissingCurrentColor(store, collection, logger);
    }

    if (!watcher) return;

    // chokidar (the watcher Astro hands loaders) emits "error" for fs errors
    // it can't treat as "path doesn't exist yet" (ENOENT/ENOTDIR), for
    // example an EPERM/EACCES while a directory is mid-delete, which
    // Windows produces far more readily than POSIX. `watcher` is shared
    // with the rest of Astro's dev server, and Node's EventEmitter throws
    // synchronously when an "error" event has no listener, so an unlucky
    // fs error here could otherwise take down watching for every other
    // file (CSS included). Adding a listener, even just to warn, prevents
    // that crash.
    watcher.on("error", (cause: unknown) => {
      const detail = cause instanceof Error ? cause.message : String(cause);
      logger.warn(
        `The local icon directory watcher for "${dirPath}" reported an error: ${detail}`,
      );
    });

    try {
      watcher.add(dirPath);
    } catch (ex) {
      const detail = ex instanceof Error ? ex.message : String(ex);
      logger.warn(
        `Failed to watch the local icon directory "${dirPath}": ${detail}`,
      );
    }

    watcher.on("add", (filePath: string) =>
      handleFileEvent("add", filePath, deps),
    );
    watcher.on("change", (filePath: string) =>
      handleFileEvent("change", filePath, deps),
    );
    watcher.on("unlink", (filePath: string) =>
      handleFileEvent("unlink", filePath, deps),
    );
  };
}
