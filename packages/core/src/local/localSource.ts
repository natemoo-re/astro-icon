import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegrationLogger } from "astro";
import { AstroIconError } from "../core/AstroIconError.js";
import { consoleLogger } from "../core/logger.js";
import { parseIconSVG } from "../core/parseIconSVG.js";
import type { IconSource } from "../core/iconSource.js";
import type { OptimizeFn } from "../../typings/types";

export interface LocalSourceOptions {
  /**
   * Restricts this source to a fixed set of icon names - the same
   * deliberate-allowlist semantics as `iconifySource`'s `icons` option.
   * Omit to allow every `.svg` file found in the directory.
   */
  icons?: string[];
  /**
   * Optional transform applied to each icon's raw SVG markup before it is parsed and stored.
   */
  optimize?: OptimizeFn;
  /**
   * When true, turns a missing/unreadable icon file into a build error
   * instead of a warning.
   * @default false
   */
  strict?: boolean;
  /**
   * Where warnings (e.g. a derived viewBox) are reported. `localIcons()`
   * passes its own `context.logger` here so they carry Astro's usual
   * `[loader-name]` label; a bare `localSource()` call falls back to
   * `console.warn` since it has no loader context to draw one from.
   */
  logger?: Pick<AstroIntegrationLogger, "warn">;
}

/**
 * An `IconSource` backed by a directory of local `.svg` files. Each file's
 * path relative to `dir` (without its extension, subdirectories joined with
 * `/`) is its icon name - `<dir>/logos/deno.svg` is `"logos/deno"`.
 *
 * Doesn't watch the directory itself - see `localIcons()`, which wires this
 * up with the file-watching a directory-backed source needs.
 */
export function localSource(dir: URL | string, options: LocalSourceOptions = {}): IconSource {
  const dirPath = dir instanceof URL ? fileURLToPath(dir) : dir;
  const { icons, optimize, strict = false, logger = consoleLogger } = options;
  const allowed = icons && new Set(icons);

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
