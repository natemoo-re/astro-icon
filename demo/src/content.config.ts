import { defineCollection } from "astro:content";
import { createIconLoader, iconify, iconifySource, localIcons } from "astro-icon/loaders";

// Each pack is restricted to the icons this demo uses; omitting `icons` would load the entire pack.
export const collections = {
  icons: defineCollection({ loader: localIcons() }),
  ic: defineCollection({
    loader: iconify("ic", {
      icons: ["baseline-account-box", "baseline-directions-run", "outline-star"],
    }),
  }),
  fe: defineCollection({ loader: iconify("fe", { icons: ["building"] }) }),
  ri: defineCollection({ loader: iconify("ri", { icons: ["aliens-fill"] }) }),
  bi: defineCollection({ loader: iconify("bi", { icons: ["stars"] }) }),
  combined: defineCollection({
    loader: createIconLoader([
      iconifySource("fe", { icons: ["activity"] }),
      iconifySource("ri", { icons: ["star-fill"] }),
    ]),
  }),
};
