import type { IconEntry } from "../../typings/types";

/**
 * A single icon source that a loader resolves names against - iconify is
 * one implementation of this (see `iconifySource`), but any icon API/pack
 * can plug in here, for either a build (`createIconLoader`) or live
 * (`createLiveIconLoader`) collection.
 */
export interface IconSource {
  /**
   * Identifies this source in the loader's name, error messages, and (for
   * live collections specifically) generated types. Should match the key
   * this source's loader is registered under in `live.config.ts` (e.g. a
   * source named `"mdi"` backing `mdi: defineLiveCollection({ loader: ...
   * })`) - `LiveLoader`s aren't told their own collection name by Astro, so
   * this is the only identity available for live typegen to key off of.
   */
  name: string;
  /**
   * Resolve a single icon by name. Throw (or reject) with a descriptive
   * error if the icon can't be found or built - loaders surface that as
   * `{ error }` (live) or a warning/skip (build) rather than crashing.
   */
  getIcon(name: string): Promise<IconEntry>;
  /**
   * Optionally list every icon name available from this source. Required
   * for a build collection (`createIconLoader` loads exactly this list);
   * for a live collection it additionally enables `getLiveCollection()`
   * and full typegen. Sources that can't reasonably enumerate their full
   * contents (e.g. an open-ended API) can omit this, or reject/throw from
   * it (e.g. `iconifySource` does, when its pack isn't installed locally).
   */
  listIcons?(): Promise<string[]>;
}
