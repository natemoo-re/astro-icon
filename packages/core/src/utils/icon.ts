import type { FileCache } from "./cache.js";
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

async function fetchCollection(collection: string): Promise<IconCollection> {
  let collectionData: IconCollection | undefined;
  try {
    const res = await fetch(getIconifyUrl(collection));
    collectionData = await res.json();
  } catch {
    throw new Error(`An error occurred while attempting to fetch icon collection "${collection}"`);
  }
  
  if (!collectionData) {
    throw new Error(`Unable to locate icon collection "${collection}"`);
  }

  return collectionData;
}

export async function getIconData(
  collection: string,
  name: string,
  { cache }: { cache: FileCache },
): Promise<IconData | undefined> {
  let collectionData = await cache.read<IconCollection>(collection);
  
  if (!collectionData) {
    collectionData = await dedupeFetch(fetchCollection, collection);
    await cache.write(collection, collectionData);
  }

  const { icons } = collectionData;
  if (icons[name] === undefined) {
    throw new Error(`Unable to locate icon "${collection}:${name}"`);
  }

  return icons[name];
}
