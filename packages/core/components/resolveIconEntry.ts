import { getEntry } from "astro:content";
import { entryCache } from "../src/core/entryCache.js";
import type { IconEntry } from "../typings/types";

/**
 * Resolves one icon's content-collection entry, going through `entryCache`
 * first. Shared by `<Icon>` and `<Sprite>` so both get the same caching and
 * "not found" behavior instead of drifting independently.
 */
export async function resolveIconEntry(
  collection: string,
  name: string,
): Promise<{ data: IconEntry } | undefined> {
  const cacheKey = `${collection}:${name}`;
  // Skipped in dev, since a process-lifetime cache would keep serving pre-edit icons.
  if (!import.meta.env.DEV) {
    const cached = entryCache.get(cacheKey);
    if (cached) return cached;
  }

  let entry: { data: IconEntry } | undefined;
  try {
    entry = (await getEntry(collection as never, name)) as { data: IconEntry } | undefined;
  } catch {
    entry = undefined;
  }
  if (entry && !import.meta.env.DEV) entryCache.set(cacheKey, entry);
  return entry;
}
