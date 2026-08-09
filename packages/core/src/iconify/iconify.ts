import type { Loader } from "astro/loaders";
import { createIconLoader } from "../loaders/createIconLoader.js";
import { iconifySource } from "./iconifySource.js";
import type { IconifySourceOptions } from "../../typings/types";

/**
 * A pre-built content layer loader for one or more Iconify icon packs -
 * `iconifySource(pack, options)` fed into `createIconLoader()`. Each pack
 * is its own collection by convention; there's no shared namespace across
 * packs unless you pass more than one here (in which case they're combined
 * into a single collection, first pack wins on a name collision).
 *
 * Prefers a locally installed `@iconify-json/<pack>` package, falling back
 * to the public Iconify API when it isn't (which can only ever resolve
 * icons you specifically request, not the whole pack).
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
