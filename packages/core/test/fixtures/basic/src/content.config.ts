import {
  defineIconCollection,
  iconify,
  localSvg,
} from "astro-icon/collections";
import type { IconSource } from "astro-icon/collections";

// A hand-written, non-iconify source - proves `defineIconCollection` isn't
// limited to combining iconify packs.
const customSource: IconSource = {
  name: "custom",
  async getIcons(names) {
    return new Map(
      names.map((name) => [
        name,
        name === "custom-square"
          ? {
              body: '<rect x="4" y="4" width="16" height="16"/>',
              viewBox: "0 0 24 24",
              width: 24,
              height: 24,
            }
          : new Error(`"custom" has no icon named "${name}"`),
      ]),
    );
  },
  async listIcons() {
    return ["custom-square"];
  },
};

export const collections = {
  // Bare `<Icon name="..." />` resolves against a collection literally
  // named "icons" - this is pure convention, not something astro-icon
  // enforces.
  icons: defineIconCollection(iconify("svg-spinners")),
  spinners: defineIconCollection(
    iconify("svg-spinners", { allowed: ["3-dots-fade"] }),
  ),
  // Combines an icon from the svg-spinners pack (explicitly limited) with
  // an icon from a completely custom source, into one collection.
  combined: defineIconCollection([
    iconify("svg-spinners", { allowed: ["180-ring"] }),
    customSource,
  ]),
  // A directory of raw .svg files (as opposed to an Iconify pack) - proves
  // license/attribution comments in a local icon's own markup survive the
  // full build pipeline (issue #177).
  local: defineIconCollection(localSvg(new URL("./icons", import.meta.url))),
};
