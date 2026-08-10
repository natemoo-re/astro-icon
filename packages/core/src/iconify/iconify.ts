import type { Loader } from "astro/loaders";
import { createIconLoader } from "../loaders/createIconLoader.js";
import { iconifySource } from "./iconifySource.js";
import type { IconifySourceOptions } from "../../typings/types";

/**
 * A content layer loader for one or more Iconify icon packs. This is what
 * most projects reach for: pass a pack name to `defineCollection()` and
 * astro-icon resolves, types, and watches it for you.
 *
 * ```ts
 * // src/content.config.ts
 * import { defineCollection } from "astro:content";
 * import { iconify } from "astro-icon/loaders";
 *
 * export const collections = {
 *   mdi: defineCollection({ loader: iconify("mdi") }),
 * };
 * ```
 *
 * Prefers a locally installed `@iconify-json/<pack>` package. If it isn't
 * installed, astro-icon falls back to the public Iconify API, which can only
 * resolve icons you request by name, not the whole pack. Install the package
 * for production builds so `listIcons()` and full autocomplete work.
 *
 * Pass an array of packs to combine them into one collection; each keeps its
 * own icon names, and the first pack wins if two share a name.
 */
export function iconify(pack: string, options: IconifySourceOptions): Loader;
export function iconify(packs: string[], options: IconifySourceOptions): Loader;
export function iconify(
  pack: string | string[],
  options: IconifySourceOptions = {},
): Loader {
  const packs = Array.isArray(pack) ? pack : [pack];
  const sources = packs.map((name) => iconifySource(name, options));
  return createIconLoader(sources, { strict: options.strict });
}
