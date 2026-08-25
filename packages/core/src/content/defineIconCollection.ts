import type { Loader } from "astro/loaders";
import { createIconLoader } from "./loader.js";
import type { IconSource } from "./source.js";

/** The `defineCollection()`-shaped config {@link defineIconCollection} produces. */
export interface IconCollectionConfig {
  type: "content_layer";
  loader: Loader;
}

/**
 * Defines one build-time icon collection from one or more {@link IconSource}s - the everyday
 * form of `defineCollection({ loader: createIconLoader(sources) })`, without the nesting:
 *
 * ```ts
 * // src/content.config.ts
 * import { defineIconCollection, iconify, localSvg } from "astro-icon/collections";
 *
 * export const collections = {
 *   mdi: defineIconCollection(iconify("mdi")),
 *   icons: defineIconCollection(localSvg()),
 * };
 * ```
 *
 * An array of sources resolves each icon by trying them in order, first match wins - the same
 * contract as `createIconLoader([...])`:
 *
 * ```ts
 * ui: defineIconCollection([localSvg("src/brand-icons"), iconify("heroicons")]),
 * ```
 *
 * To supply your own Zod schema, drop down a layer and use Astro's `defineCollection` with
 * `createIconLoader` yourself: `defineCollection({ loader: createIconLoader(sources), schema })`.
 */
export function defineIconCollection(
  sources: IconSource | IconSource[],
): IconCollectionConfig {
  // The same shape Astro's `defineCollection()` returns, built directly: that helper guesses its
  // caller from the stack and throws for any frame inside `live.config.*`, which this module's
  // frame can be once bundled into a server chunk.
  return { type: "content_layer", loader: createIconLoader(sources) };
}
