import type { IconifyJSON } from "@iconify/types";
import { loadCollectionFromFS } from "@iconify/utils/lib/loader/fs";
import type { AstroIntegrationLogger } from "astro";
import { AstroIconError } from "../core/AstroIconError.js";
import { formatDuration } from "../core/formatDuration.js";

export interface ResolvePackOptions {
  strict?: boolean;
  logger: Pick<AstroIntegrationLogger, "warn" | "debug">;
}

// Shared across every loader instance in this process; keyed by `<pack>` (full local install) or `<pack>:<sorted icons>` (API subset). Failed lookups aren't cached, so they're retried.
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

// Packs already warned about, so the notice doesn't repeat per icon requested.
const warnedPacks = new Set<string>();

function warnMissingLocalPackOnce(
  pack: string,
  logger: Pick<AstroIntegrationLogger, "warn">,
): void {
  if (warnedPacks.has(pack)) return;
  warnedPacks.add(pack);
  logger.warn(
    `"${pack}" icon set was not found locally, falling back to the Iconify API for individual icon lookups (works, but slower, and it can only ever resolve icons you specifically request). Install it for better performance: \`npm install @iconify-json/${pack}\`. (Logged once per pack.)`,
  );
}

/** Clears the shared pack cache and warning state; for tests only. */
export function __clearPackCache(): void {
  packCache.clear();
  warnedPacks.clear();
}

/** Resolves a full pack from a locally installed `@iconify-json/<pack>` package, if present. */
export function resolveLocalPack(pack: string): Promise<IconifyJSON | undefined> {
  return cachedPackResolution(pack, () =>
    loadCollectionFromFS(pack).catch(() => undefined),
  );
}

/** Resolves an iconify collection, preferring a local install and falling back to the Iconify API; `strict` turns the fallback into a hard error. */
export async function resolvePack(
  pack: string,
  icons: string[] | undefined,
  { strict = false, logger }: ResolvePackOptions,
): Promise<IconifyJSON> {
  const localStart = performance.now();
  const local = await resolveLocalPack(pack);
  if (local) {
    logger.debug(
      `Resolved "${pack}" from a local install in ${formatDuration(performance.now() - localStart)}.`,
    );
    return local;
  }
  logger.debug(
    `"${pack}" isn't installed locally (checked in ${formatDuration(performance.now() - localStart)}).`,
  );

  if (strict) {
    throw new AstroIconError(
      `Could not find the "${pack}" icon set locally.`,
      `Install it with \`npm install @iconify-json/${pack}\`, or disable "strict" to allow falling back to the Iconify API.`,
    );
  }

  if (!icons?.length) {
    // The Iconify API can't return "the whole pack"; a full pack needs a local install.
    throw new AstroIconError(
      `"${pack}" isn't installed locally, so the full icon set can't be resolved from the Iconify API.`,
      `Install \`@iconify-json/${pack}\`, or request specific icons by name instead.`,
    );
  }

  warnMissingLocalPackOnce(pack, logger);

  const apiStart = performance.now();
  const sortedIcons = Array.from(new Set(icons)).sort();
  const remote = await cachedPackResolution(
    `${pack}:${sortedIcons.join(",")}`,
    () => fetchPackFromAPI(pack, sortedIcons),
  );
  const apiDuration = formatDuration(performance.now() - apiStart);
  if (!remote) {
    throw new AstroIconError(
      `Could not resolve the "${pack}" icon set from the Iconify API.`,
      `Install "@iconify-json/${pack}" locally, or verify the pack and icon names are correct.`,
    );
  }
  logger.debug(
    `Resolved ${sortedIcons.length} icon(s) of "${pack}" from the Iconify API in ${apiDuration}.`,
  );
  return remote;
}

/** A bare `<pack>.json` request (no `icons=` param) returns `200 OK` with the literal body `"404"`, so always pass a subset. */
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
