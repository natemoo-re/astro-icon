import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { IconifyJSON } from "@iconify/types";
import { loadCollectionFromFS } from "@iconify/utils/lib/loader/fs";
import type { AstroIntegrationLogger } from "astro";
import { AstroIconError } from "../../internal/error.js";
import { formatDuration } from "../duration.js";

export interface LoadPackFromAPIOptions {
  logger: Pick<AstroIntegrationLogger, "debug">;
}

// Shared across every loader instance in this process; keyed by `<pack>` (full local install) or `<pack>:<sorted icons>` (API subset). Failed lookups aren't cached, so they're retried.
const packCache = new Map<string, Promise<IconifyJSON | undefined>>();

function cachedPackLoad(
  key: string,
  load: () => Promise<IconifyJSON | undefined>,
): Promise<IconifyJSON | undefined> {
  let promise = packCache.get(key);
  if (!promise) {
    promise = load();
    packCache.set(key, promise);
    promise.then(
      (result) => {
        if (!result) packCache.delete(key);
      },
      () => packCache.delete(key),
    );
  }
  return promise;
}

/**
 * Clears the shared pack cache; for tests only.
 * @private
 */
export function __clearPackCache(): void {
  packCache.clear();
}

let loadFromFS: typeof loadCollectionFromFS = loadCollectionFromFS;

/**
 * Swaps the local-pack filesystem loader for a fake, so a test doesn't need a real `@iconify-json/*` package installed; for tests only.
 * @private
 */
export function __setLoadFromFS(fn: typeof loadCollectionFromFS): void {
  loadFromFS = fn;
}

type RequireResolvePack = (pack: string) => Promise<IconifyJSON | undefined>;

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
async function requireResolvePack(
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

let loadViaRequireResolve: RequireResolvePack = requireResolvePack;

/**
 * Swaps the `require.resolve` fallback for a fake, so a test doesn't need a real `@iconify-json/*` package installed; for tests only.
 * @private
 */
export function __setLoadViaRequireResolve(fn: RequireResolvePack): void {
  loadViaRequireResolve = fn;
}

/**
 * The real `require.resolve`-based fallback, exported so a test can restore it after swapping
 * in a fake via {@link __setLoadViaRequireResolve}, or exercise it directly; for tests only.
 * @private
 */
export { requireResolvePack as __requireResolvePack };

/**
 * Loads a full pack from a locally installed `@iconify-json/<pack>` package, if present.
 *
 * Tries `loadFromFS` first (fast, and works with an `autoInstall`-style setup), then falls
 * back to `require.resolve`. `loadFromFS` resolves the pack via `import-meta-resolve`, a
 * filesystem-only ESM resolver that walks `node_modules` directories on disk - it never goes
 * through Node's real module loader, so it can't see a package resolved through Yarn Berry's
 * PnP `.pnp.cjs` hook (there's no `node_modules` to walk at all). `require.resolve` does go
 * through the real (CJS) loader, so it works under PnP too. See
 * https://github.com/natemoo-re/astro-icon/issues/263.
 */
export function loadLocalPack(pack: string): Promise<IconifyJSON | undefined> {
  return cachedPackLoad(pack, async () => {
    const viaFS = await loadFromFS(pack).catch(() => undefined);
    if (viaFS) return viaFS;
    return loadViaRequireResolve(pack);
  });
}

/**
 * Loads a pack from the public Iconify API, scoped to `icons` - the API can't return "the whole
 * pack" the way a local install can, only an explicit `icons=` subset, so `icons` is required
 * and empty is rejected outright rather than silently resolving nothing.
 */
export async function loadPackFromAPI(
  pack: string,
  icons: string[],
  { logger }: LoadPackFromAPIOptions,
): Promise<IconifyJSON> {
  if (!icons.length) {
    throw new AstroIconError(
      `"${pack}" was requested from the Iconify API with no icons named.`,
      `The Iconify API can only resolve icons you name explicitly. Pass an \`icons: [...]\` option, or use \`iconifyLocalSource\` (which needs "@iconify-json/${pack}" installed) for the whole pack.`,
    );
  }

  const apiStart = performance.now();
  const sortedIcons = Array.from(new Set(icons)).sort();
  const remote = await cachedPackLoad(`${pack}:${sortedIcons.join(",")}`, () =>
    fetchPackFromAPI(pack, sortedIcons),
  );
  const apiDuration = formatDuration(performance.now() - apiStart);
  if (!remote) {
    throw new AstroIconError(
      `Could not load the "${pack}" icon set from the Iconify API.`,
      `Verify the pack and icon names are correct, or install "@iconify-json/${pack}" locally and use \`iconifyLocalSource\` instead.`,
    );
  }
  logger.debug(
    `Loaded ${sortedIcons.length} icon(s) of "${pack}" from the Iconify API in ${apiDuration}.`,
  );
  return remote;
}

/**
 * A bare `<pack>.json` request (no `icons=` param) returns `200 OK` with the literal body `"404"`, so always pass a subset.
 * @link https://iconify.design/docs/api/icon-data.html
 */
async function fetchPackFromAPI(
  pack: string,
  icons: string[],
): Promise<IconifyJSON | undefined> {
  const search = `?icons=${encodeURIComponent(Array.from(new Set(icons)).join(","))}`;
  const res = await fetch(
    `https://api.iconify.design/${pack}.json${search}`,
  ).catch(() => undefined);
  if (!res || !res.ok) return undefined;
  const data = await res.json().catch(() => undefined);
  if (data == null || !Object.prototype.hasOwnProperty.call(data, "icons"))
    return undefined;
  if (!(data as { icons: unknown }).icons) return undefined;
  return data;
}
