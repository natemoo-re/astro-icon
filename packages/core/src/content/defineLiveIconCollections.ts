import type { LiveLoader } from "astro/loaders";
import { createLiveIconLoader } from "./liveLoader.js";
import type { IconSource } from "./source.js";
import type { TypegenRecorder } from "./typegen/index.js";
import type { IconEntry } from "../../typings/types";

/** The `defineLiveCollection()`-shaped config {@link defineLiveIconCollections} produces per key. */
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
 * import { iconify, defineLiveIconCollections } from "astro-icon/collections";
 *
 * export const collections = {
 *   ...defineLiveIconCollections({
 *     spinners: iconify("svg-spinners"),
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
export function defineLiveIconCollections<
  T extends Record<string, IconSource | IconSource[]>,
>(
  sources: T,
  // Not part of the documented public surface - forwarded to `createLiveIconLoader` so tests can
  // substitute an in-memory typegen recorder instead of mocking the whole typegen module.
  options?: { typegen?: Pick<TypegenRecorder, "recordCollection"> },
): Record<keyof T, LiveIconCollectionConfig> {
  const collections = {} as Record<keyof T, LiveIconCollectionConfig>;
  for (const key of Object.keys(sources) as (keyof T & string)[]) {
    // The same shape Astro's `defineLiveCollection()` returns, built directly: that helper
    // guesses its caller from the stack and throws for any frame outside `live.config.*`,
    // which this module's frame can be once bundled into a server chunk.
    collections[key] = {
      type: "live",
      loader: createLiveIconLoader(sources[key], {
        collection: key,
        typegen: options?.typegen,
      }),
    };
  }
  return collections;
}
