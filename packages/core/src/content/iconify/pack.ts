import type { IconifyJSON } from "@iconify/types";
import { loadCollectionFromFS } from "@iconify/utils/lib/loader/fs";
import type { AstroIntegrationLogger } from "astro";
import { AstroIconError } from "../../internal/error.js";
import { formatDuration } from "../duration.js";
import { createIconifyApiPolicy } from "./apiPolicy.js";
import { requireResolvePack } from "./requireResolvePack.js";

export interface LoadPackFromAPIOptions {
  logger: Pick<AstroIntegrationLogger, "debug">;
}

export interface PackLoader {
  loadLocalPack(
    pack: string,
    cwd?: string,
  ): Promise<IconifyJSON | undefined>;
  loadPackFromAPI(
    pack: string,
    icons: string[],
    options: LoadPackFromAPIOptions,
  ): Promise<IconifyJSON>;
}

// A single request was confirmed to work with 300 icons in one query; this stays well under
// that as a margin against a proxy/server URL-length ceiling we haven't tested against, while
// keeping "how many icons does one bad response cost" small for a very large `allowed: [...]`.
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
 * Builds an independent `PackLoader`: its own pack cache and its own `IconifyApiPolicy`
 * (concurrency/rate-limit/retry), scoped to this instance rather than shared ambiently across
 * the whole process. `iconifyLocalSource`/`iconifyApiSource` share one instance of this (below),
 * built once - deliberately, so a local install or an API pack fetched once is reused across
 * every collection built from it in the same process, not re-read/re-fetched per source. Tests
 * exercising `loadLocalPack`/`loadPackFromAPI` directly construct their own instance instead, for
 * a cache that starts empty without resetting the module registry.
 */
export function createPackLoader(): PackLoader {
  // Keyed by `<pack>` (full local install) or `<pack>:<sorted icons>` (API subset). Failed
  // lookups aren't cached, so they're retried.
  const packCache = new Map<string, Promise<IconifyJSON | undefined>>();
  const apiPolicy = createIconifyApiPolicy();

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

  async function fetchPackChunk(
    pack: string,
    icons: string[],
  ): Promise<IconifyJSON | undefined> {
    const search = `?icons=${encodeURIComponent(icons.join(","))}`;
    const res = await apiPolicy.fetch(
      `https://api.iconify.design/${pack}.json${search}`,
    );
    if (!res || !res.ok) return undefined;
    const data = await res.json().catch(() => undefined);
    if (data == null || !Object.prototype.hasOwnProperty.call(data, "icons"))
      return undefined;
    if (!(data as { icons: unknown }).icons) return undefined;
    return data;
  }

  /**
   * A bare `<pack>.json` request (no `icons=` param) returns `200 OK` with the literal body
   * `"404"`, so always pass a subset. @link https://iconify.design/docs/api/icon-data.html
   *
   * `icons` beyond `MAX_ICONS_PER_REQUEST` is split across multiple requests (run concurrently -
   * there are only ever a handful of chunks even for a very large explicit `allowed: [...]` list)
   * and merged back into one pack; any one chunk failing fails the whole load, matching the
   * existing all-or-nothing contract for a single request.
   */
  async function fetchPackFromAPI(
    pack: string,
    icons: string[],
  ): Promise<IconifyJSON | undefined> {
    const groups = chunk(icons, MAX_ICONS_PER_REQUEST);
    const results = await Promise.all(
      groups.map((group) => fetchPackChunk(pack, group)),
    );
    if (results.some((result) => !result)) return undefined;
    return mergePackChunks(results as IconifyJSON[]);
  }

  return {
    /**
     * Loads a full pack from a locally installed `@iconify-json/<pack>` package, if present.
     *
     * Tries `loadCollectionFromFS` first (fast, and works with an `autoInstall`-style setup),
     * then falls back to `require.resolve`. `loadCollectionFromFS` resolves the pack via
     * `import-meta-resolve`, a filesystem-only ESM resolver that walks `node_modules`
     * directories on disk - it never goes through Node's real module loader, so it can't see a
     * package resolved through Yarn Berry's PnP `.pnp.cjs` hook (there's no `node_modules` to
     * walk at all). `require.resolve` does go through the real (CJS) loader, so it works under
     * PnP too. See https://github.com/natemoo-re/astro-icon/issues/263.
     *
     * `cwd` defaults to `process.cwd()` for a caller with no better root to give (matches this
     * function's long-standing behavior); `iconifyLocalSource` passes its `resolveRoot`-anchored
     * root once one is available. Included in the cache key so two different roots for the same
     * pack name - a rare case, but possible across composed sources in one process - don't
     * collide.
     */
    loadLocalPack(
      pack: string,
      cwd: string = process.cwd(),
    ): Promise<IconifyJSON | undefined> {
      return cachedPackLoad(`${cwd}::${pack}`, async () => {
        const viaFS = await loadCollectionFromFS(
          pack,
          undefined,
          undefined,
          cwd,
        ).catch(() => undefined);
        if (viaFS) return viaFS;
        return requireResolvePack(pack, cwd);
      });
    },

    /**
     * Loads a pack from the public Iconify API, scoped to `icons` - the API can't return "the
     * whole pack" the way a local install can, only an explicit `icons=` subset, so `icons` is
     * required and empty is rejected outright rather than silently resolving nothing.
     */
    async loadPackFromAPI(
      pack: string,
      icons: string[],
      { logger }: LoadPackFromAPIOptions,
    ): Promise<IconifyJSON> {
      if (!icons.length) {
        throw new AstroIconError(
          `"${pack}" was requested from the Iconify API with no icons named.`,
          `The Iconify API can only resolve icons you name explicitly. Pass an \`allowed: [...]\` option, or use \`iconifyLocalSource\` (which needs "@iconify-json/${pack}" installed) for the whole pack.`,
        );
      }

      const apiStart = performance.now();
      const sortedIcons = Array.from(new Set(icons)).sort();
      const remote = await cachedPackLoad(
        `${pack}:${sortedIcons.join(",")}`,
        () => fetchPackFromAPI(pack, sortedIcons),
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
    },
  };
}

const defaultPackLoader = createPackLoader();

/** @see {@link PackLoader.loadLocalPack} */
export const loadLocalPack: PackLoader["loadLocalPack"] =
  defaultPackLoader.loadLocalPack;

/** @see {@link PackLoader.loadPackFromAPI} */
export const loadPackFromAPI: PackLoader["loadPackFromAPI"] =
  defaultPackLoader.loadPackFromAPI;
