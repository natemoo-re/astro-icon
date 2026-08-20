import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { IconifyJSON } from "@iconify/types";

/**
 * Resolves a locally installed `@iconify-json/<pack>`'s `icons.json` the same way
 * `getPackVersion` (in `../iconify/source.ts`) resolves its `package.json`: via
 * `createRequire(...).resolve(...)`, real Node CJS resolution rather than a filesystem walk.
 * Under Yarn Berry's PnP linker, `require.resolve` goes through the `.pnp.cjs` hook and finds
 * the package; a plain ESM dynamic `import()` of the same subpath does not - verified against
 * a real `@iconify-json/*`-shaped `exports` map, where PnP's ESM loader fails to resolve a
 * conditional subpath export even though the CJS `require.resolve` for the identical subpath
 * succeeds. cwd, not `import.meta.resolve`, to reach the consuming project's install (mirrors
 * `getPackVersion`).
 */
export async function requireResolvePack(
  pack: string,
): Promise<IconifyJSON | undefined> {
  try {
    const require = createRequire(join(process.cwd(), "package.json"));
    const jsonPath = require.resolve(`@iconify-json/${pack}/icons.json`);
    const raw = await readFile(jsonPath, "utf-8");
    return JSON.parse(raw) as IconifyJSON;
  } catch {
    return undefined;
  }
}
