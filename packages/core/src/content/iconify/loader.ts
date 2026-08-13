import type { Loader } from "astro/loaders";
import { createIconLoader } from "../loader.js";
import { iconifySource } from "./source.js";
import type { IconifySourceOptions } from "../../../typings/types";
import type { IconifyIconName } from "../../../typings/names";

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
 *
 * The `icons: [...]` option is typed and autocompleted against the pack's
 * own catalog. A duplicate name in that array is deduped and logged as a
 * warning at runtime (see `iconifySource`), not rejected at the type level.
 * This only kicks in once astro-icon has recorded the pack's full icon list
 * from a previous sync (`astro sync`/`dev`/`build`); until then it falls
 * back to a plain `string`.
 */
export function iconify<
  Pack extends string,
  const Icons extends readonly IconifyIconName<Pack>[] = readonly IconifyIconName<Pack>[],
>(
  pack: Pack,
  options?: Omit<IconifySourceOptions, "icons"> & { icons?: Icons },
): Loader;
export function iconify<
  Packs extends readonly string[],
  const Icons extends readonly IconifyIconName<Packs[number]>[] = readonly IconifyIconName<Packs[number]>[],
>(
  packs: Packs,
  options?: Omit<IconifySourceOptions, "icons"> & { icons?: Icons },
): Loader;
export function iconify(
  pack: string | string[],
  options: IconifySourceOptions = {},
): Loader {
  const packs = Array.isArray(pack) ? pack : [pack];
  const sources = packs.map((name) => iconifySource(name, options));
  return createIconLoader(sources, { strict: options.strict });
}
