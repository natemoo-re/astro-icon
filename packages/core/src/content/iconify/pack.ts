import type { IconifyJSON } from "@iconify/types";
import { loadCollectionFromFS } from "@iconify/utils/lib/loader/fs";
import type { AstroIntegrationLogger } from "astro";
import { AstroIconError } from "../../internal/error.js";
import type { RateLimiter } from "../../utils/rateLimiter.js";
import { fetchJSON } from "../../utils/fetch.js";
import { formatDuration } from "../duration.js";
import { requireResolvePack } from "./requireResolvePack.js";

export interface LoadPackFromAPIOptions {
  logger: Pick<AstroIntegrationLogger, "debug">;
  /** Awaited before each request to the Iconify API, if given; see `iconifyApiSource`'s `requestsPerSecond` option. */
  rateLimiter?: RateLimiter;
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
 * Loads a full pack from a locally installed `@iconify-json/<pack>` package, if present.
 *
 * Tries `loadCollectionFromFS` first (fast, and works with an `autoInstall`-style setup), then
 * falls back to `require.resolve`. `loadCollectionFromFS` resolves the pack via `import-meta-resolve`, a
 * filesystem-only ESM resolver that walks `node_modules` directories on disk - it never goes
 * through Node's real module loader, so it can't see a package resolved through Yarn Berry's
 * PnP `.pnp.cjs` hook (there's no `node_modules` to walk at all). `require.resolve` does go
 * through the real (CJS) loader, so it works under PnP too. See
 * https://github.com/natemoo-re/astro-icon/issues/263.
 *
 * `cwd` defaults to `process.cwd()` for a caller with no better root to give (matches this
 * function's long-standing behavior); `iconifyLocalSource` passes its `resolveRoot`-anchored
 * root once one is available. Included in the cache key so two different roots for the same
 * pack name - a rare case, but possible across composed sources in one process - don't collide.
 */
export function loadLocalPack(
  pack: string,
  cwd: string = process.cwd(),
): Promise<IconifyJSON | undefined> {
  return cachedPackLoad(`${cwd}::${pack}`, async () => {
    const viaFS = await loadCollectionFromFS(pack, undefined, undefined, cwd).catch(
      () => undefined,
    );
    if (viaFS) return viaFS;
    return requireResolvePack(pack, cwd);
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
  { logger, rateLimiter }: LoadPackFromAPIOptions,
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
    fetchPackFromAPI(pack, sortedIcons, rateLimiter),
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

// A single request was confirmed to work with 300 icons in one query; this stays well under
// that as a margin against a proxy/server URL-length ceiling we haven't tested against, while
// keeping "how many icons does one bad response cost" small for a very large `icons: [...]`.
const MAX_ICONS_PER_REQUEST = 200;

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/** Combines same-pack chunk responses into one `IconifyJSON`, merging `icons`/`aliases`. */
function mergePackChunks(chunks: IconifyJSON[]): IconifyJSON {
  const [first, ...rest] = chunks;
  if (rest.length === 0) return first;
  const icons = { ...first.icons };
  const aliases = { ...first.aliases };
  for (const next of rest) {
    Object.assign(icons, next.icons);
    if (next.aliases) Object.assign(aliases, next.aliases);
  }
  return { ...first, icons, aliases };
}

/**
 * A bare `<pack>.json` request (no `icons=` param) returns `200 OK` with the literal body `"404"`, so always pass a subset.
 * @link https://iconify.design/docs/api/icon-data.html
 *
 * `icons` beyond `MAX_ICONS_PER_REQUEST` is split across multiple requests (run concurrently -
 * there are only ever a handful of chunks even for a very large explicit `icons: [...]` list) and
 * merged back into one pack; any one chunk failing fails the whole load, matching the existing
 * all-or-nothing contract for a single request.
 */
async function fetchPackFromAPI(
  pack: string,
  icons: string[],
  rateLimiter: RateLimiter | undefined,
): Promise<IconifyJSON | undefined> {
  const groups = chunk(icons, MAX_ICONS_PER_REQUEST);
  const results = await Promise.all(
    groups.map((group) => fetchPackChunk(pack, group, rateLimiter)),
  );
  if (results.some((result) => !result)) return undefined;
  return mergePackChunks(results as IconifyJSON[]);
}

async function fetchPackChunk(
  pack: string,
  icons: string[],
  rateLimiter: RateLimiter | undefined,
): Promise<IconifyJSON | undefined> {
  if (rateLimiter) await rateLimiter();
  const search = `?icons=${encodeURIComponent(icons.join(","))}`;
  // `fetchJSON` throws on a network failure, a non-OK status, or invalid JSON - all three collapse
  // to `undefined` here, same as before, since `fetchPackFromAPI` already treats any one chunk
  // failing as failing the whole load.
  const data = await fetchJSON<unknown>(
    `https://api.iconify.design/${pack}.json${search}`,
  ).catch(() => undefined);
  if (data == null || !Object.prototype.hasOwnProperty.call(data, "icons"))
    return undefined;
  if (!(data as { icons: unknown }).icons) return undefined;
  return data as IconifyJSON;
}
