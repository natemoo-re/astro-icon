import type { AstroIntegrationLogger } from "astro";
import type { FileCache } from "./cache.js";
import { AstroIconError } from "./error.js";
import { dedupeFetch } from "./fetch.js";

interface IconCollection {
  prefix: string;
  info: Record<string, string>;
  lastModified: number;
  icons: Record<string, IconData>;
  aliases: Record<string, IconData>;
  // Manually injected for additional caching techniques
  etag?: string;
}
interface IconData {
  body: string;
  width?: number;
  height?: number;
  hidden?: boolean;
}

const ICONIFY_REPO = new URL(
  "https://raw.githubusercontent.com/iconify/icon-sets/master/json/"
);

function getIconifyUrl(collection: string) {
  return new URL(`./${collection}.json`, ICONIFY_REPO);
}

async function fetchCollection(
  collection: string,
  { cache, __DEV__ }: { cache: FileCache; __DEV__: boolean }
): Promise<IconCollection> {
  // Initialize with cached data
  let collectionData = await cache.read<IconCollection>(collection);
  const headers: HeadersInit = {};

  if (collectionData?.lastModified) {
    headers["If-Modified-Since"] = new Date(
      collectionData.lastModified
    ).toUTCString();
  }

  if (collectionData?.etag) {
    headers["If-None-Match"] = collectionData.etag;
  }

  try {
    collectionData = await dedupeFetch(async (collectionName) => {
      const res = await fetch(getIconifyUrl(collectionName), { headers });

      if (res.status === 304 && collectionData) {
        // No changes, return cached data
        return collectionData;
      }

      const data = await res.json();
      // Inject the etag for caching
      data.etag = res.headers.get("etag");

      return data;
    }, collection);
  } catch {}

  if (!collectionData) {
    const err = new AstroIconError(
      `Unable to locate the icon collection "${collection}"`
    );
    if (__DEV__) {
      err.hint = `The "${collection}" icon collection does not exist.\n\nIs this a typo?`;
    }
    throw err;
  }
  await cache.write(collection, collectionData);

  return collectionData;
}

export async function getIconData(
  collection: string,
  name: string,
  {
    cache,
    logger,
    __DEV__,
  }: { cache: FileCache; logger: AstroIntegrationLogger; __DEV__: boolean }
): Promise<IconData | undefined> {
  const collectionData = await fetchCollection(collection, {
    cache,
    __DEV__,
  });

  const { icons, aliases } = collectionData;
  const icon = icons[name] ?? aliases[name];
  if (icon === undefined) {
    const err = new AstroIconError(
      `Unable to locate the icon "${collection}:${name}"`
    );
    if (__DEV__) {
      err.hint = `The "${collection}" icon collection does not include an icon named "${name}".\n\nIs this a typo?`;
    }
    throw err;
  }

  if (icon.hidden) {
    logger.warn(
      `Deprecation Warning: The icon "${collection}:${name}" has been removed from the icon set.`
    );
  }

  return icon;
}
