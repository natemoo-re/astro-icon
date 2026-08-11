import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Loader } from "astro/loaders";
import { AstroIconError } from "../core/AstroIconError.js";
import { formatDuration } from "../core/formatDuration.js";
import { iconEntrySchema } from "../core/iconEntrySchema.js";
import { listIconsOrFallback } from "../core/listIconsOrFallback.js";
import { recordCollection } from "../typegen.js";
import { localSource } from "./localSource.js";
import type { LocalSourceOptions } from "./localSource.js";

/** Cheap (no SVGO) fingerprint of a file's raw contents, to detect whether it actually changed. */
function hashSource(raw: string): string {
  return createHash("sha1").update(raw).digest("hex");
}

/**
 * Cheap fingerprint of the whole directory: `mtime` + `size` per file
 * (via `stat`, not a content read) so an unchanged sync can be detected
 * without reading (let alone re-optimizing) a single `.svg`.
 */
async function getDirVersionKey(dirPath: string, names: string[]): Promise<string> {
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
export function localIcons(dir: string = "src/icons", options: LocalSourceOptions = {}): Loader {
  const strict = options.strict ?? false;

  return {
    name: "astro-icon/loaders",
    schema: iconEntrySchema,
    load: async (context) => {
      const { store, meta, logger, parseData, generateDigest, config, watcher, collection } = context;

      const dirUrl = new URL(dir.replace(/\/?$/, "/"), config.root);
      const dirPath = fileURLToPath(dirUrl);
      const source = localSource(dirUrl, { ...options, logger });

      if (!existsSync(dirPath)) {
        logger.warn(
          `The local icon directory "${dirPath}" does not exist. Create it, or point "localIcons()" at a different "dir".`,
        );
      }

      function idFromPath(filePath: string): string | undefined {
        if (!filePath.startsWith(dirPath) || !filePath.endsWith(".svg")) return undefined;
        return filePath
          .slice(dirPath.length)
          .replace(/\\/g, "/")
          .replace(/^\//, "")
          .slice(0, -".svg".length);
      }

      // Skips re-running `optimize`/SVGO if the source file's hash matches `previous`'s.
      async function syncIcon(
        id: string,
        previous?: { data: Record<string, unknown>; digest?: string | number },
      ): Promise<void> {
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
            if (previous && previous.data._sourceHash === sourceHash) {
              store.set({ id, data: previous.data, digest: previous.digest });
              return;
            }
            const data = await source.getIcon(id);
            const parsedData = await parseData({ id, data: { ...data, _sourceHash: sourceHash } });
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

      async function updateTypes(): Promise<void> {
        await recordCollection(config.root, "build", collection, [...store.keys()]);
      }

      const syncStart = performance.now();

      const names = await listIconsOrFallback(source, {
        strict,
        logger,
        failureMessage: (detail) => `Failed to list local icons in "${dirPath}": ${detail}`,
        hint: `Fix the error above, or disable "strict" to skip local icons with a warning instead.`,
      });

      // Skip re-reading/re-optimizing every file if the directory's mtime+size
      // fingerprint matches the last sync - cheap to check via `stat`, unlike
      // the per-file content hash `syncIcon` uses once it's already reading a file.
      const metaKey = `astro-icon:version:${collection}`;
      const versionKey = await getDirVersionKey(dirPath, names);
      if (versionKey === meta.get(metaKey) && names.every((name) => store.has(name))) {
        await updateTypes();
        logger.debug(
          `"${collection}" is already up to date (${names.length} icon(s)), skipped in ${formatDuration(performance.now() - syncStart)}.`,
        );
      } else {
        // Snapshot before clearing so syncIcon can skip unchanged icons.
        const previousEntries = new Map(store.entries());
        store.clear();
        for (const id of names) {
          await syncIcon(id, previousEntries.get(id));
        }
        await updateTypes();
        meta.set(metaKey, versionKey);

        logger.info(
          `Loaded ${names.length} icon(s) from "${collection}" in ${formatDuration(performance.now() - syncStart)}.`,
        );
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
      watcher.on("error", (error: unknown) => {
        const detail = error instanceof Error ? error.message : String(error);
        logger.warn(`The local icon directory watcher for "${dirPath}" reported an error: ${detail}`);
      });

      try {
        watcher.add(dirPath);
      } catch (ex) {
        const detail = ex instanceof Error ? ex.message : String(ex);
        logger.warn(`Failed to watch the local icon directory "${dirPath}": ${detail}`);
      }

      watcher.on("add", async (filePath: string) => {
        const id = idFromPath(filePath);
        if (!id) return;
        await syncIcon(id, store.get(id));
        await updateTypes();
        logger.info(`Added local icon "${id}"`);
      });

      watcher.on("change", async (filePath: string) => {
        const id = idFromPath(filePath);
        if (!id) return;
        await syncIcon(id, store.get(id));
        logger.info(`Reloaded local icon "${id}"`);
      });

      watcher.on("unlink", async (filePath: string) => {
        const id = idFromPath(filePath);
        if (!id) return;
        store.delete(id);
        await updateTypes();
        logger.info(`Removed local icon "${id}"`);
      });
    },
  };
}
