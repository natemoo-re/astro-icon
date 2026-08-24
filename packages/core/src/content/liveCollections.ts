import type { LiveLoader } from "astro/loaders";
import { createLiveIconLoader } from "./liveLoader.js";
import type { IconSource } from "./source.js";
import type { IconEntry } from "../../typings/types";

/** The `defineLiveCollection()`-shaped config {@link liveIconCollections} produces per key. */
export interface LiveIconCollectionConfig {
  type: "live";
  loader: LiveLoader<IconEntry, { id: string }, { ids: string[] }>;
}

/**
 * Builds the `collections` entries for one or more live icon collections,
 * with each key written exactly once: it becomes the Astro collection key
 * and the generated `LiveCollectionName` type at the same time, so the two
 * can never drift (the risk of declaring `createLiveIconLoader`'s
 * `collection` option by hand).
 *
 * ```ts
 * // src/live.config.ts
 * import { iconifyLocalSource, liveIconCollections } from "astro-icon/loaders/live";
 *
 * export const collections = {
 *   ...liveIconCollections({
 *     spinners: iconifyLocalSource("svg-spinners"),
 *   }),
 *   // non-icon live collections use Astro's own defineLiveCollection() as usual
 * };
 * ```
 *
 * `getLiveCollection("spinners", { ids: [...] })` resolves that specific
 * list of names in one batched call, rather than one `<LiveIcon>`/
 * `getLiveEntry()` per name - reach for it when every name is already known
 * up front (a search result set, saved user picks), not just individually
 * dynamic.
 */
export function liveIconCollections<
  T extends Record<string, IconSource | IconSource[]>,
>(sources: T): Record<keyof T, LiveIconCollectionConfig> {
  const collections = {} as Record<keyof T, LiveIconCollectionConfig>;
  for (const key of Object.keys(sources) as (keyof T & string)[]) {
    // The same shape Astro's `defineLiveCollection()` returns, built directly: that helper
    // guesses its caller from the stack and throws for any frame outside `live.config.*`,
    // which this module's frame can be once bundled into a server chunk.
    collections[key] = {
      type: "live",
      loader: createLiveIconLoader(sources[key], { collection: key }),
    };
  }
  return collections;
}
