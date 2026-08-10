import type { LiveLoader } from "astro/loaders";
import { createLiveIconLoader } from "./createLiveIconLoader.js";
import { iconifySource } from "../iconify/iconifySource.js";
import type { IconEntry, IconifySourceOptions } from "../../typings/types";

/**
 * A live content collection loader for one or more Iconify icon packs,
 * resolved on demand per request rather than at build time: `iconifySource`
 * fed into {@link createLiveIconLoader}.
 *
 * Use `createLiveIconLoader` and `iconifySource` directly if you need to
 * back `<LiveIcon>` with a different pack format or API.
 */
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
