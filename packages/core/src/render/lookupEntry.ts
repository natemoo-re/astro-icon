import { getCollection, getEntry, type DataEntry } from "astro:content";
import type { IconEntry } from "../../typings/types";

type IconDataEntry = Omit<DataEntry, "data"> & { data: IconEntry };

/**
 * Looks up one icon's content-collection entry via Astro's own `getEntry()`.
 * No caching of our own here, because `getEntry` already reads from Astro's
 * in-memory content store, so a second cache on top of it would only add a
 * Map and a key format for no measurable win.
 *
 * Falls back to a case-insensitive scan of the collection via
 * `getCollection()` (still an in-memory read, no I/O) when the exact name
 * misses, because a request and its real entry can differ by case in either
 * direction. Warns in dev when that fallback is what matched, since it
 * means the entry's real name differs from what was requested.
 */
export async function resolveIconEntry(
  collection: string,
  name: string,
): Promise<IconDataEntry | undefined> {
  const exact = await lookup(collection, name);
  if (exact) return exact;

  const fallback = await lookupCaseInsensitive(collection, name);
  if (fallback && import.meta.env.DEV) {
    console.warn(
      `[astro-icon] "${name}" only matched the "${collection}" collection's "${fallback.id}" entry case-insensitively. Use "${fallback.id}" instead to match it directly.`,
    );
  }
  return fallback;
}

async function lookup(
  collection: string,
  name: string,
): Promise<IconDataEntry | undefined> {
  try {
    return await getEntry(collection, name);
  } catch {
    return undefined;
  }
}

async function lookupCaseInsensitive(
  collection: string,
  name: string,
): Promise<IconDataEntry | undefined> {
  const lowercased = name.toLowerCase();
  try {
    const entries: IconDataEntry[] = await getCollection(
      collection,
      (entry: DataEntry) => entry.id.toLowerCase() === lowercased,
    );
    return entries[0];
  } catch {
    return undefined;
  }
}
