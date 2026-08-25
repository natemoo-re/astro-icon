import type { IconifyJSON } from "@iconify/types";
import { getIconData, iconToSVG } from "@iconify/utils";
import type { IconEntry } from "../../../typings/types";

/**
 * Renders one icon out of a loaded Iconify pack (see `loadLocalPack`/`loadPackFromAPI`) straight
 * into an `IconEntry` - never touching an SVG string. `iconToSVG`'s own `attributes` only ever
 * contains `width`/`height`/`viewBox` (never a presentation attribute like `fill`), so `body` is
 * `rendered.body` verbatim: there's nothing on the root worth lifting onto the entry, and nothing
 * that needs stripping out of the body either.
 *
 * Returns `undefined` for a name the pack doesn't have - `undefined`, not a thrown error, because
 * "this pack doesn't include that icon" is an expected outcome callers branch on, not a failure of
 * this function itself.
 */
export function entryFromIconifyData(
  data: IconifyJSON,
  name: string,
): IconEntry | undefined {
  const iconData = getIconData(data, name);
  if (!iconData) return undefined;

  const rendered = iconToSVG(iconData);
  const [, , width, height] = rendered.viewBox;

  return {
    body: rendered.body,
    viewBox: rendered.attributes.viewBox,
    width,
    height,
  };
}
