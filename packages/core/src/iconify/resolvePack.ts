import type { IconifyJSON } from "@iconify/types";
import { loadCollectionFromFS } from "@iconify/utils/lib/loader/fs";
import type { AstroIntegrationLogger } from "astro";
import { AstroIconError } from "../core/AstroIconError.js";

export interface ResolvePackOptions {
  strict?: boolean;
  logger: Pick<AstroIntegrationLogger, "warn">;
}

// Shared across every loader instance in this process (the build `iconify()`
// loader and any number of `iconifySource()`-backed live loaders commonly
// resolve the same pack independently otherwise).
//
// Keyed by `<pack>` for a full pack (from a local install - the only way to
// get "everything") and `<pack>:<sorted icons>` for an API-fallback subset
// (the public API can only ever return the icons you explicitly ask for,
// see `fetchPackFromAPI`) - a bare pack name and a `pack:icons` string can
// never collide, since iconify pack names never contain a colon.
//
// Only successful resolutions are kept - a failed lookup (pack not
// installed yet, transient network error) isn't cached, so it's retried
// rather than "stuck" for the life of the process.
const packCache = new Map<string, Promise<IconifyJSON | undefined>>();

function cachedPackResolution(
  key: string,
  resolve: () => Promise<IconifyJSON | undefined>,
): Promise<IconifyJSON | undefined> {
  let promise = packCache.get(key);
  if (!promise) {
    promise = resolve();
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

// Packs already warned about (see `warnMissingLocalPackOnce` below) - a live
// source resolves one icon at a time, so without this the same "not
// installed locally" notice would repeat for every distinct icon requested
// through it. Reset only by process restart (or `__clearPackCache` in tests).
const warnedPacks = new Set<string>();

function warnMissingLocalPackOnce(
  pack: string,
  logger: Pick<AstroIntegrationLogger, "warn">,
): void {
  if (warnedPacks.has(pack)) return;
  warnedPacks.add(pack);
  logger.warn(
    `"${pack}" icon set was not found locally - falling back to the Iconify API for individual icon lookups (works, but slower, and it can only ever resolve icons you specifically request). Install it for better performance: \`npm install @iconify-json/${pack}\`. (Logged once per pack.)`,
  );
}

/** Clears the shared pack cache and warning state - for tests only. */
export function __clearPackCache(): void {
  packCache.clear();
  warnedPacks.clear();
}

/**
 * Resolves a full pack from a locally installed `@iconify-json/<pack>`
 * package, if present. Shares its result across every caller in this
 * process via the module-level pack cache.
 */
export function resolveLocalPack(pack: string): Promise<IconifyJSON | undefined> {
  return cachedPackResolution(pack, () =>
    loadCollectionFromFS(pack).catch(() => undefined),
  );
}

/**
 * Resolves an iconify collection, preferring a locally installed
 * `@iconify-json/<pack>` package and falling back to the public Iconify API.
 *
 * Under `strict`, a pack that isn't installed locally is a hard error
 * instead of a warn + fallback.
 */
export async function resolvePack(
  pack: string,
  icons: string[] | undefined,
  { strict = false, logger }: ResolvePackOptions,
): Promise<IconifyJSON> {
  const local = await resolveLocalPack(pack);
  if (local) return local;

  if (strict) {
    throw new AstroIconError(
      `Could not find the "${pack}" icon set locally.`,
      `Install it with \`npm install @iconify-json/${pack}\`, or disable "strict" to allow falling back to the Iconify API.`,
    );
  }

  if (!icons?.length) {
    // The public Iconify API only returns real data for an explicit `icons=`
    // subset - there's no way to fetch "the whole pack" from it. A full
    // pack needs a local install.
    throw new AstroIconError(
      `"${pack}" isn't installed locally, so the full icon set can't be resolved from the Iconify API.`,
      `Install \`@iconify-json/${pack}\`, or request specific icons by name instead.`,
    );
  }

  warnMissingLocalPackOnce(pack, logger);

  const sortedIcons = Array.from(new Set(icons)).sort();
  const remote = await cachedPackResolution(
    `${pack}:${sortedIcons.join(",")}`,
    () => fetchPackFromAPI(pack, sortedIcons),
  );
  if (!remote) {
    throw new AstroIconError(
      `Could not resolve the "${pack}" icon set from the Iconify API.`,
      `Install "@iconify-json/${pack}" locally, or verify the pack and icon names are correct.`,
    );
  }
  return remote;
}

/**
 * The public Iconify API only returns real icon data for a `.json` request
 * that specifies an explicit `icons=` subset - a bare `<pack>.json` request
 * (no `icons` param) responds `200 OK` with the literal body `"404"`
 * instead of an error status. Always pass a subset here.
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
  if (!isIconifyJSON(data)) return undefined;
  return data;
}

function isIconifyJSON(data: unknown): data is IconifyJSON {
  return (
    typeof data === "object" &&
    data !== null &&
    "icons" in data &&
    typeof (data as { icons: unknown }).icons === "object"
  );
}
