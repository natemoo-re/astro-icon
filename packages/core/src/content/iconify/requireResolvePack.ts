import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { IconifyJSON } from "@iconify/types";

/**
 * Resolves a locally installed `@iconify-json/<pack>`'s `<subpath>` (e.g. `icons.json`, or
 * `package.json` for `getPackVersion` in `../iconify/source.ts`) via `createRequire(...).resolve(...)`,
 * real Node CJS resolution rather than a filesystem walk. Under Yarn Berry's PnP linker,
 * `require.resolve` goes through the `.pnp.cjs` hook and finds the package; a plain ESM dynamic
 * `import()` of the same subpath does not - verified against a real `@iconify-json/*`-shaped
 * `exports` map, where PnP's ESM loader fails to resolve a conditional subpath export even
 * though the CJS `require.resolve` for the identical subpath succeeds.
 *
 * `cwd` should be the project root - `iconifyLocalSource` anchors it via `resolveRoot`, falling
 * back to `process.cwd()` only until that fires (see `IconSource.resolveRoot`'s doc comment for
 * why the two can differ, e.g. `astro build --root <dir>` invoked from elsewhere).
 */
export function resolveIconifyPackFile(
  pack: string,
  subpath: string,
  cwd: string,
): string | undefined {
  try {
    return createRequire(join(cwd, "package.json")).resolve(
      `@iconify-json/${pack}/${subpath}`,
    );
  } catch {
    return undefined;
  }
}

/** Resolves a locally installed `@iconify-json/<pack>`'s `icons.json` via {@link resolveIconifyPackFile}. */
export async function requireResolvePack(
  pack: string,
  cwd: string,
): Promise<IconifyJSON | undefined> {
  const jsonPath = resolveIconifyPackFile(pack, "icons.json", cwd);
  if (!jsonPath) return undefined;
  try {
    const raw = await readFile(jsonPath, "utf-8");
    return JSON.parse(raw) as IconifyJSON;
  } catch {
    return undefined;
  }
}
