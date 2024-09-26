import type { FileCache } from "./cache.js";
import { AstroIconError } from "./error.js";
import { dedupeFetch } from "./fetch.js";

interface IconCollection {
  prefix: string;
  info: Record<string, string>;
  lastModified: number;
  icons: Record<string, IconData>;
}
interface IconData {
  body: string;
  width?: number;
  height?: number;
}

const ICONIFY_REPO = new URL(
  `https://raw.githubusercontent.com/iconify/icon-sets/master/json/`,
);

function getIconifyUrl(collection: string) {
  return new URL(`./${collection}.json`, ICONIFY_REPO);
}

async function fetchCollection(
  collection: string,
  { cache }: { cache: FileCache },
): Promise<IconCollection> {
  let collectionData = await cache.read<IconCollection>(collection);
  if (collectionData) {
    return collectionData;
  }

  try {
    collectionData = await dedupeFetch(async (collectionName) => {
      const res = await fetch(getIconifyUrl(collectionName));
      return res.json();
    }, collection);
  } catch {}

  if (!collectionData) {
    const err = new AstroIconError(
      `Unable to locate the icon collection "${collection}"`,
    );
    if (import.meta.env.DEV) {
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
  { cache }: { cache: FileCache },
): Promise<IconData | undefined> {
  const collectionData = await fetchCollection(collection, { cache });

  const { icons } = collectionData;
  if (icons[name] === undefined) {
    const err = new AstroIconError(
      `Unable to locate the icon "${collection}:${name}"`,
    );
    if (import.meta.env.DEV) {
      err.hint = `The "${collection}" icon collection does not include an icon named "${name}".\n\nIs this a typo?`;
    }
    throw err;
  }

  return icons[name];
}
