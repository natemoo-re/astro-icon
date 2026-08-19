import { getEntry } from "astro:content";
import type { IconEntry } from "../../typings/types";

/**
 * Looks up one icon's content-collection entry via Astro's own `getEntry()`.
 * Shared by `<Icon>` and `<Sprite>` so both get the same "not found" behavior
 * instead of drifting independently. No caching of our own here - `getEntry`
 * already reads from Astro's in-memory content store, so a second cache on
 * top of it would only add a Map and a key format for no measurable win.
 *
 * Falls back to a lowercase-normalized retry - still just an in-memory
 * lookup, no I/O - if the exact name misses, so e.g. `name="Deno"` still
 * resolves against an entry actually keyed `"deno"` (see
 * https://github.com/natemoo-re/astro-icon/issues/189); warns in dev when
 * that fallback is what matched, since it means the entry's real name
 * differs from what was requested.
 */
export async function resolveIconEntry(
  collection: string,
  name: string,
): Promise<{ data: IconEntry } | undefined> {
  const exact = await lookup(collection, name);
  if (exact) return exact;

  const lowercased = name.toLowerCase();
  if (lowercased === name) return undefined;

  const fallback = await lookup(collection, lowercased);
  if (fallback && import.meta.env.DEV) {
    console.warn(
      `[astro-icon] "${name}" only matched the "${collection}" collection's "${lowercased}" entry case-insensitively. Use "${lowercased}" instead to match it directly.`,
    );
  }
  return fallback;
}

async function lookup(
  collection: string,
  name: string,
): Promise<{ data: IconEntry } | undefined> {
  try {
    return (await getEntry(collection, name)) as
      { data: IconEntry } | undefined;
  } catch {
    return undefined;
  }
}
