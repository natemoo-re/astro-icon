import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegrationLogger } from "astro";
import { AstroIconError } from "../../internal/error.js";
import { consoleLogger } from "../logger.js";
import { parseIconSVG } from "../parseIconSVG.js";
import { looksLikeItNeedsCurrentColor } from "./currentColorHint.js";
import type { IconSource } from "../source.js";
import type { IconEntry, OptimizeFn } from "../../../typings/types";

export interface LocalSourceOptions {
  /**
   * Restricts this source to a fixed list of icon names, the same
   * deliberate allowlist semantics as {@link IconifySourceOptions.icons}.
   * Omit it to allow every `.svg` file found in the directory.
   */
  icons?: string[];
  /** Optional transform applied to each icon's raw SVG markup before it is parsed and stored. */
  optimize?: OptimizeFn;
  /**
   * When true, turns a missing/unreadable icon file into a build error
   * instead of a warning.
   * @default false
   */
  strict?: boolean;
  /** Where warnings are reported; defaults to `console.warn` if not passed a loader's own logger. */
  logger?: Pick<AstroIntegrationLogger, "warn">;
}

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
 * icons: defineCollection({ loader: createIconLoader(localSource()) }),
 * ```
 *
 * Each file's path relative to `dir` becomes its icon name: `<dir>/logos/deno.svg` is
 * `"logos/deno"`.
 *
 * A plain relative string (the common case, including the default) resolves against the project
 * root once `createIconLoader`/`createLiveIconLoader` gives this source one via `resolveRoot()` -
 * see that method's doc comment on `IconSource`. Pass a `URL` instead (e.g.
 * `localSource(new URL("../icons/", import.meta.url))`) to anchor a directory that ships inside
 * your own package, resolved relative to your module rather than the consumer's project root.
 *
 * Implements `getVersion()` (a stat-based fingerprint of the directory) and `watch()` (dev-mode
 * file watching), so `createIconLoader` skips an unchanged sync and live-reloads a changed one -
 * including when several `localSource()`s are composed together via
 * `mergeSources`/`createIconLoader([...])`. See the footgun documented on `IconSource.watch`
 * about composing sources with overlapping icon names.
 */
export function localSource(
  dir: URL | string = "src/icons",
  options: LocalSourceOptions = {},
): IconSource {
  let dirPath = resolveDirPath(dir);
  const { icons, optimize, strict = false, logger = consoleLogger } = options;
  const allowed = icons && new Set(icons);

  if (icons && allowed && allowed.size !== icons.length) {
    const seen = new Set<string>();
    const duplicates = icons.filter(
      (name) => seen.size === seen.add(name).size,
    );
    logger.warn(
      `The local source's \`icons: [...]\` option repeats ${duplicates.length === 1 ? "a name" : "names"}: ${[...new Set(duplicates)].map((name) => `"${name}"`).join(", ")}. Duplicates are silently deduped; remove the repeat(s) to avoid confusion.`,
    );
  }

  // Per-file cache, keyed by the file's own content hash - not just its name - so a "change"
  // event chokidar fires for a write that didn't actually change the bytes (a `touch`, some
  // editors' save-as-copy behavior) skips re-running `optimize`/parsing entirely.
  const cache = new Map<string, { hash: string; entry: IconEntry }>();

  let warnedMissingDir = false;
  function warnIfDirMissing(): void {
    if (warnedMissingDir || existsSync(dirPath)) return;
    warnedMissingDir = true;
    logger.warn(
      `The local icon directory "${dirPath}" does not exist. Create it, or point \`localSource\` at a different directory.`,
    );
  }

  async function readIcon(name: string): Promise<IconEntry> {
    if (allowed && !allowed.has(name)) {
      throw new AstroIconError(
        `"${name}" isn't in the allowed icon list for the local source at "${dirPath}" (${icons!.length} icon(s) allowed).`,
        `Add "${name}" to the \`icons: [...]\` option for this source, or remove the option to allow every ".svg" file in the directory.`,
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

    const entry = await parseIconSVG(svg, {
      collection: "local",
      name,
      optimize,
      strict,
      logger,
    });
    cache.set(name, { hash, entry });

    // A one-time, best-effort nudge (never a mutation - see the "Styling icons" README section
    // for why astro-icon doesn't rewrite colors automatically) toward the `svgo()` currentColor
    // recipe, logged whenever a freshly-parsed icon looks like it won't respond to CSS `color`.
    // Runs per icon, on every fresh parse (cache misses only) rather than once per whole-directory
    // sync, so it also covers an icon added/edited later via `watch()`, not just the initial load.
    if (looksLikeItNeedsCurrentColor(entry.body)) {
      logger.warn(
        `"${name}" in "${dirPath}" doesn't appear to use "currentColor" and won't respond to CSS \`color\`. See the "Styling icons" section of the README, or pass \`optimize: svgo({ plugins: [{ name: "preset-default", params: { overrides: { convertColors: { currentColor: true } } } }] })\` from "astro-icon/optimize" to convert it.`,
      );
    }

    return entry;
  }

  async function listNames(): Promise<string[]> {
    if (allowed) return [...icons!];
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
    getIcon: readIcon,
    async listIcons() {
      return listNames();
    },
    // Cheap (no file reads) fingerprint of the whole directory: `mtime` + `size` per file via
    // `stat`, so `createIconLoader` can skip an entire resync - including every `getIcon` call -
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
