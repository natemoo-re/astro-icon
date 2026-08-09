import { defineCollection } from "astro:content";
import { createIconLoader, iconify, iconifySource } from "astro-icon/loaders";
import type { IconSource } from "astro-icon/loaders";

// A hand-written, non-iconify source - proves `createIconLoader` isn't
// limited to combining iconify packs.
const customSource: IconSource = {
  name: "custom",
  async getIcon(name) {
    if (name !== "custom-square") {
      throw new Error(`"custom" has no icon named "${name}"`);
    }
    return {
      body: '<rect x="4" y="4" width="16" height="16"/>',
      viewBox: "0 0 24 24",
      width: 24,
      height: 24,
    };
  },
  async listIcons() {
    return ["custom-square"];
  },
};

export const collections = {
  // Bare `<Icon name="..." />` resolves against a collection literally
  // named "icons" - this is pure convention, not something astro-icon
  // enforces.
  icons: defineCollection({ loader: iconify("svg-spinners") }),
  spinners: defineCollection({
    loader: iconify("svg-spinners", { icons: ["3-dots-fade"] }),
  }),
  // Combines an icon from the svg-spinners pack (explicitly limited) with
  // an icon from a completely custom source, into one collection.
  combined: defineCollection({
    loader: createIconLoader([
      iconifySource("svg-spinners", { icons: ["180-ring"] }),
      customSource,
    ]),
  }),
};
