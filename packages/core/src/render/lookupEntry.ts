import { getEntry } from "astro:content";
import type { IconEntry } from "../../typings/types";

/**
 * Looks up one icon's content-collection entry via Astro's own `getEntry()`.
 * Shared by `<Icon>` and `<Sprite>` so both get the same "not found" behavior
 * instead of drifting independently. No caching of our own here - `getEntry`
 * already reads from Astro's in-memory content store, so a second cache on
 * top of it would only add a Map and a key format for no measurable win.
 */
export async function resolveIconEntry(
  collection: string,
  name: string,
): Promise<{ data: IconEntry } | undefined> {
  try {
    return (await getEntry(collection as never, name)) as { data: IconEntry } | undefined;
  } catch {
    return undefined;
  }
}
