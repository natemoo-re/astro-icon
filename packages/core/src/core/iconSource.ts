import type { createIconLoader } from "../loaders/createIconLoader.js";
import type { createLiveIconLoader } from "../loaders/createLiveIconLoader.js";
import type { IconEntry } from "../../typings/types";

/**
 * The interface for plugging a custom icon backend into astro-icon.
 * `iconifySource` (Iconify packs) and `localSource` (a directory of `.svg`
 * files) are astro-icon's own implementations; write your own to fetch icons
 * from a design tool, a database, or an internal API.
 *
 * Pass one to {@link createIconLoader} for a build-time collection, or to
 * {@link createLiveIconLoader} for one resolved per request.
 */
export interface IconSource {
  /**
   * Identifies this source in error messages and, for a live collection,
   * generated types. Set it to the same key you register the loader under
   * in `live.config.ts`: a `LiveLoader` is never told its own collection
   * name by Astro, so this is the only identity typegen has to key off of.
   */
  name: string;
  /**
   * Resolves one icon by name. Throw (or reject) with a descriptive error if
   * the icon can't be found or built. A loader turns that into `{ error }`
   * for a live collection, or a warning plus a skipped icon for a build one.
   */
  getIcon(name: string): Promise<IconEntry>;
  /**
   * Lists every icon name this source can resolve. Required for a build
   * collection: `createIconLoader` loads exactly this list. Optional for a
   * live one, where it additionally enables `getLiveCollection()` and full
   * autocomplete instead of a plain `string` type.
   */
  listIcons?(): Promise<string[]>;
  /**
   * Reports a cheap freshness signal for this source, such as an installed
   * pack's npm version. If every source in a collection reports one and it
   * matches the last sync, `createIconLoader` skips re-resolving anything.
   * Omit it if there's no reliable way to tell "nothing changed" short of
   * resolving; the loader always falls back to a full resolve.
   */
  getVersion?(): Promise<string | undefined>;
}
