import type { LiveLoader } from "astro/loaders";
import { createLiveIconLoader } from "./createLiveIconLoader.js";
import { iconifySource } from "../iconify/iconifySource.js";
import type { IconEntry, IconifySourceOptions } from "../../typings/types";
import type { IconifyIconName } from "../../typings/names";

/**
 * A live content collection loader for one or more Iconify icon packs,
 * resolved on demand per request rather than at build time: `iconifySource`
 * fed into {@link createLiveIconLoader}.
 *
 * Use `createLiveIconLoader` and `iconifySource` directly if you need to
 * back `<LiveIcon>` with a different pack format or API.
 *
 * Like `iconify()`, the `icons: [...]` option is typed and autocompleted
 * against the pack's own catalog, once astro-icon has recorded that pack
 * from a previous sync. A duplicate name is deduped and logged as a warning
 * at runtime, not rejected at the type level.
 */
export function iconifyLive<
  Pack extends string,
  const Icons extends readonly IconifyIconName<Pack>[] = readonly IconifyIconName<Pack>[],
>(
  pack: Pack,
  options?: Omit<IconifySourceOptions, "icons"> & { icons?: Icons },
): LiveLoader<IconEntry, { id: string }, never>;
export function iconifyLive<
  Packs extends readonly string[],
  const Icons extends readonly IconifyIconName<Packs[number]>[] = readonly IconifyIconName<Packs[number]>[],
>(
  packs: Packs,
  options?: Omit<IconifySourceOptions, "icons"> & { icons?: Icons },
): LiveLoader<IconEntry, { id: string }, never>;
export function iconifyLive(
  pack: string | string[],
  options: IconifySourceOptions = {},
): LiveLoader<IconEntry, { id: string }, never> {
  const packs = Array.isArray(pack) ? pack : [pack];
  return createLiveIconLoader(packs.map((name) => iconifySource(name, options)));
}

export { createLiveIconLoader, iconifySource };
export { AstroIconError } from "../core/AstroIconError.js";
export type { IconSource } from "../core/iconSource.js";
