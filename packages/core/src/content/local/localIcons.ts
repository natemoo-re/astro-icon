import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegrationLogger } from "astro";
import { AstroIconError } from "../../internal/error.js";
import { consoleLogger } from "../logger.js";
import { entryFromSVG } from "../ingest/entryFromSVG.js";
import type { IconSource } from "../source.js";
import type {
  IconEntry,
  OptimizeFn,
  TransformFn,
} from "../../../typings/types";

export interface LocalIconsOptions {
  /**
   * Restricts this source to a fixed list of icon names, the same
   * deliberate allowlist semantics as {@link IconifySourceOptions.allowed}.
   * Omit it to allow every `.svg` file found in the directory.
   */
  allowed?: string[];
  /**
   * Transform applied to each icon's raw file contents before it's parsed and stored - the one
   * place `optimize` still lives, since `localIcons` is the one built-in source that starts
   * from a raw SVG string in the first place.
   */
  optimize?: OptimizeFn;
  /** Transform applied to each icon's built `IconEntry`, after `optimize`, last, before it's returned. */
  transform?: TransformFn;
  /** Where warnings are reported; defaults to `console.warn` if not passed a loader's own logger. */
  logger?: Pick<AstroIntegrationLogger, "warn">;
}

/** The collection name a local icon reports in warnings, errors, and `optimize`'s context. */
const COLLECTION = "local";

function hashContent(raw: string): string {
  return createHash("sha1").update(raw).digest("hex");
}

/** Resolves `dir` to an absolute path: a `URL`/absolute string is used as-is; a plain relative string is anchored to `root` if given, or left for Node's own `fs` calls to resolve against `process.cwd()` otherwise. */
function resolveDirPath(dir: URL | string, root?: URL): string {
  if (dir instanceof URL) return fileURLToPath(dir);
  if (isAbsolute(dir)) return dir;
  if (!root) return dir;
  return fileURLToPath(new URL(dir.replace(/\/?$/, "/"), root));
}

/**
 * An {@link IconSource} backed by a directory of local `.svg` files, `src/icons` by default -
 * the suggested default for the `icons` collection:
 *
 * ```ts
 * icons: defineCollection({ loader: createIconLoader(localIcons()) }),
 * ```
 *
 * Each file's path relative to `dir` becomes its icon name: `<dir>/logos/deno.svg` is
 * `"logos/deno"`.
 *
 * A plain relative string (the common case, including the default) resolves against the project
 * root once `createIconLoader`/`createLiveIconLoader` gives this source one via `resolveRoot()` -
 * see that method's doc comment on `IconSource`. Pass a `URL` instead (e.g.
 * `localIcons(new URL("../icons/", import.meta.url))`) to anchor a directory that ships inside
 * your own package, resolved relative to your module rather than the consumer's project root.
 *
 * Implements `getVersion()` (a stat-based fingerprint of the directory) and `watch()` (dev-mode
 * file watching), so `createIconLoader` skips an unchanged sync and live-reloads a changed one -
 * including when several `localIcons()`s are composed together via
 * `mergeSources`/`createIconLoader([...])`. See the footgun documented on `IconSource.watch`
 * about composing sources with overlapping icon names.
 */
export function localIcons(
  dir: URL | string = "src/icons",
  options: LocalIconsOptions = {},
): IconSource {
  let dirPath = resolveDirPath(dir);
  const {
    allowed: allowedList,
    optimize,
    transform,
    logger = consoleLogger,
  } = options;
  const allowed = allowedList && new Set(allowedList);

  if (allowedList && allowed && allowed.size !== allowedList.length) {
    const seen = new Set<string>();
    const duplicates = allowedList.filter(
      (name) => seen.size === seen.add(name).size,
    );
    logger.warn(
      `The local source's \`allowed: [...]\` option repeats ${duplicates.length === 1 ? "a name" : "names"}: ${[...new Set(duplicates)].map((name) => `"${name}"`).join(", ")}. Duplicates are silently deduped; remove the repeat(s) to avoid confusion.`,
    );
  }

  // Per-file cache, keyed by the file's own content hash - not just its name - so a "change"
  // event chokidar fires for a write that didn't actually change the bytes (a `touch`, some
  // editors' save-as-copy behavior) skips re-running `optimize`/parsing entirely.
  const cache = new Map<string, { hash: string; entry: IconEntry }>();

  // `dirPath` for display in a warning: the original `dir` as given, when it's a string - usually
  // already the short, relative form a caller wrote (`"src/icons"`), with no resolving needed. An
  // absolute `dirPath` is mostly noise once you already know it's "the local icon directory".
  // Falls back to the resolved `dirPath` for a `URL` (e.g. one anchored to a bundled package
  // directory), which wouldn't be any more readable printed as a raw `file://` string.
  function displayDirPath(): string {
    return typeof dir === "string" ? dir : dirPath;
  }

  let warnedMissingDir = false;
  function warnIfDirMissing(): void {
    if (warnedMissingDir || existsSync(dirPath)) return;
    warnedMissingDir = true;
    logger.warn(
      `The local icon directory "${dirPath}" does not exist. Create it, or point \`localIcons\` at a different directory.`,
    );
  }

  async function readIcon(name: string): Promise<IconEntry> {
    if (allowed && !allowed.has(name)) {
      throw new AstroIconError(
        `"${name}" isn't in the allowed icon list for the local source at "${dirPath}" (${allowedList!.length} icon(s) allowed).`,
        `Add "${name}" to the \`allowed: [...]\` option for this source, or remove the option to allow every ".svg" file in the directory.`,
      );
    }
    const filePath = join(dirPath, `${name}.svg`);
    const svg = await readFile(filePath, "utf-8").catch(() => {
      throw new AstroIconError(
        `No local icon file found for "${name}" (expected "${filePath}").`,
        `Add a ".svg" file at that path, or check for a typo in the icon name.`,
      );
    });

    const hash = hashContent(svg);
    const cached = cache.get(name);
    if (cached && cached.hash === hash) return cached.entry;

    const optimizedSvg = optimize
      ? await optimize(svg, { collection: COLLECTION, name })
      : svg;

    let { entry, facts } = entryFromSVG(optimizedSvg);

    if (facts.viewBox === "missing") {
      logger.warn(
        `"${name}" in "${displayDirPath()}" has no usable viewBox, falling back to "${entry.viewBox}". Check the source file (or your "optimize" function, if set) to avoid this.`,
      );
    }

    // A one-time, best-effort nudge (never a mutation - see the "Styling icons" README section
    // for why astro-icon doesn't rewrite colors automatically) toward the `svgo()` currentColor
    // recipe, logged whenever a freshly-parsed icon looks like it won't respond to CSS `color`.
    // Runs per icon, on every fresh parse (cache misses only) rather than once per whole-directory
    // sync, so it also covers an icon added/edited later via `watch()`, not just the initial load.
    if (facts.monochromeWithoutCurrentColor) {
      logger.warn(
        `"${name}" in "${displayDirPath()}" doesn't use "currentColor", so CSS \`color\` won't affect it. See "Styling icons" in the README.`,
      );
    }

    if (transform)
      entry = await transform(entry, { collection: COLLECTION, name });

    cache.set(name, { hash, entry });
    return entry;
  }

  async function listNames(): Promise<string[]> {
    // A Set, so a duplicated `allowed: [...]` name is deduped here too, matching the warning above.
    if (allowed) return [...allowed];
    warnIfDirMissing();
    return walkSvgFiles(dirPath);
  }

  /**
   * Maps a watcher-reported absolute file path back to this source's icon name, or `undefined`
   * if it's outside this directory (or not a `.svg`) - using `relative()` rather than a plain
   * prefix check, so a sibling directory that merely starts with the same characters (`icons` vs
   * `icons-extra`) isn't mistaken for a descendant.
   */
  function idFromPath(filePath: string): string | undefined {
    if (!filePath.endsWith(".svg")) return undefined;
    const rel = relative(dirPath, filePath);
    if (rel.startsWith("..") || isAbsolute(rel)) return undefined;
    return rel.replace(/\\/g, "/").slice(0, -".svg".length);
  }

  return {
    name: "local",
    // Nothing to batch at the request level (each name is its own file read), so this just fans
    // `readIcon` out over every name in `names` at once - already cheap, and each file's own
    // content-hash cache (above) means a repeat request for the same unchanged file doesn't even
    // hit the filesystem twice.
    async getIcons(names) {
      const result = new Map<string, IconEntry | Error>();
      await Promise.all(
        names.map(async (name) => {
          try {
            result.set(name, await readIcon(name));
          } catch (ex) {
            result.set(name, ex instanceof Error ? ex : new Error(String(ex)));
          }
        }),
      );
      return result;
    },
    async listIcons() {
      return listNames();
    },
    // Cheap (no file reads) fingerprint of the whole directory: `mtime` + `size` per file via
    // `stat`, so `createIconLoader` can skip an entire resync - including every `getIcons` call -
    // without reading (let alone re-optimizing) a single `.svg`.
    async getVersion() {
      const names = await listNames().catch(() => undefined);
      if (!names) return undefined;
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
      return hashContent(entries.join(","));
    },
    watch(watcher, report) {
      warnIfDirMissing();

      // chokidar (the watcher Astro hands loaders) emits "error" for fs errors it can't treat as
      // "path doesn't exist yet" (ENOENT/ENOTDIR) - an EPERM/EACCES while a directory is
      // mid-delete, which Windows produces far more readily than POSIX. `watcher` is shared with
      // the rest of Astro's dev server, and Node's EventEmitter throws synchronously when an
      // "error" event has no listener, so an unlucky fs error here could otherwise take down
      // watching for every other file (CSS included). Adding a listener, even just to warn,
      // prevents that crash.
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

      watcher.on("add", (filePath: string) => {
        const id = idFromPath(filePath);
        if (!id) return;
        report({ type: "add", name: id });
      });
      watcher.on("change", (filePath: string) => {
        const id = idFromPath(filePath);
        if (!id) return;
        report({ type: "change", name: id });
      });
      watcher.on("unlink", (filePath: string) => {
        const id = idFromPath(filePath);
        if (!id) return;
        cache.delete(id);
        report({ type: "unlink", name: id });
      });
    },
    resolveRoot(root: URL) {
      dirPath = resolveDirPath(dir, root);
    },
  };
}

async function walkSvgFiles(dir: string, prefix = ""): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const names: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      names.push(
        ...(await walkSvgFiles(
          full,
          prefix ? `${prefix}/${entry.name}` : entry.name,
        )),
      );
    } else if (entry.name.endsWith(".svg")) {
      const name = entry.name.slice(0, -".svg".length);
      names.push(prefix ? `${prefix}/${name}` : name);
    }
  }
  return names;
}
