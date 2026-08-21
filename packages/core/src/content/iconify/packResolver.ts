import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { IconifyJSON } from "@iconify/types";

/**
 * Everything that needs `require.resolve`-based access to a locally installed
 * `@iconify-json/<pack>` for one project root, bound once instead of re-deriving a `require`
 * function (and re-threading `cwd`) on every call. `cwd` should be the project root -
 * `iconifyLocalSource` anchors it via `resolveRoot`, falling back to `process.cwd()` only until
 * that fires (see `IconSource.resolveRoot`'s doc comment for why the two can differ, e.g.
 * `astro build --root <dir>` invoked from elsewhere).
 */
export interface IconifyPackResolver {
  readonly cwd: string;
  /**
   * Resolves a locally installed `@iconify-json/<pack>`'s `<subpath>` (e.g. `icons.json` or
   * `package.json`) via `require.resolve`, real Node CJS resolution rather than a filesystem
   * walk. Under Yarn Berry's PnP linker, `require.resolve` goes through the `.pnp.cjs` hook and
   * finds the package; a plain ESM dynamic `import()` of the same subpath does not - verified
   * against a real `@iconify-json/*`-shaped `exports` map, where PnP's ESM loader fails to
   * resolve a conditional subpath export even though the CJS `require.resolve` for the identical
   * subpath succeeds.
   */
  resolveFile(pack: string, subpath: string): string | undefined;
  /** Resolves a locally installed `@iconify-json/<pack>`'s `icons.json` via {@link resolveFile}. */
  loadIcons(pack: string): Promise<IconifyJSON | undefined>;
}

/** Builds an {@link IconifyPackResolver} anchored to `cwd`, creating its underlying `require` function once for every lookup this resolver instance ever does. */
export function createIconifyPackResolver(cwd: string): IconifyPackResolver {
  const require = createRequire(join(cwd, "package.json"));

  function resolveFile(pack: string, subpath: string): string | undefined {
    try {
      return require.resolve(`@iconify-json/${pack}/${subpath}`);
    } catch {
      return undefined;
    }
  }

  return {
    cwd,
    resolveFile,
    async loadIcons(pack: string): Promise<IconifyJSON | undefined> {
      const jsonPath = resolveFile(pack, "icons.json");
      if (!jsonPath) return undefined;
      try {
        const raw = await readFile(jsonPath, "utf-8");
        return JSON.parse(raw) as IconifyJSON;
      } catch {
        return undefined;
      }
    },
  };
}
