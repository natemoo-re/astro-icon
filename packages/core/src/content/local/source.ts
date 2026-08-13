import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegrationLogger } from "astro";
import { AstroIconError } from "../../internal/error.js";
import { consoleLogger } from "../logger.js";
import { parseIconSVG } from "../parseIconSVG.js";
import type { IconSource } from "../source.js";
import type { createIconLoader } from "../loader.js";
import type { createLiveIconLoader } from "../liveLoader.js";
import type { IconifySourceOptions, OptimizeFn } from "../../../typings/types";

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

/**
 * An {@link IconSource} backed by a directory of local `.svg` files.
 * `localIcons()` uses this internally and adds file watching; reach for
 * `localSource` directly when you compose it with other sources through
 * {@link createIconLoader} or {@link createLiveIconLoader}, since it doesn't
 * watch the directory on its own.
 *
 * Each file's path relative to `dir` becomes its icon name, the same
 * convention `localIcons()` uses: `<dir>/logos/deno.svg` is `"logos/deno"`.
 */
export function localSource(dir: URL | string, options: LocalSourceOptions = {}): IconSource {
  const dirPath = dir instanceof URL ? fileURLToPath(dir) : dir;
  const { icons, optimize, strict = false, logger = consoleLogger } = options;
  const allowed = icons && new Set(icons);

  if (icons && allowed && allowed.size !== icons.length) {
    const seen = new Set<string>();
    const duplicates = icons.filter((name) => seen.size === seen.add(name).size);
    logger.warn(
      `The local source's \`icons: [...]\` option repeats ${duplicates.length === 1 ? "a name" : "names"}: ${[...new Set(duplicates)].map((name) => `"${name}"`).join(", ")}. Duplicates are silently deduped; remove the repeat(s) to avoid confusion.`,
    );
  }

  return {
    name: "local",
    async getIcon(name) {
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
      return parseIconSVG(svg, { collection: "local", name, optimize, strict, logger });
    },
    async listIcons() {
      if (allowed) return [...icons!];
      return walkSvgFiles(dirPath);
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
      names.push(...(await walkSvgFiles(full, prefix ? `${prefix}/${entry.name}` : entry.name)));
    } else if (entry.name.endsWith(".svg")) {
      const name = entry.name.slice(0, -".svg".length);
      names.push(prefix ? `${prefix}/${name}` : name);
    }
  }
  return names;
}
