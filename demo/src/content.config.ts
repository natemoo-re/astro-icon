import { defineCollection } from "astro:content";
import {
  createIconLoader,
  iconifyLocalSource,
  localSource,
} from "astro-icon/loaders";

// Each pack is restricted to the icons this demo uses; omitting `allowed` would load the entire pack.
export const collections = {
  icons: defineCollection({ loader: createIconLoader(localSource()) }),
  ic: defineCollection({
    loader: createIconLoader(
      iconifyLocalSource("ic", {
        allowed: [
          "baseline-account-box",
          "baseline-directions-run",
          "outline-star",
        ],
      }),
    ),
  }),
  fe: defineCollection({
    loader: createIconLoader(iconifyLocalSource("fe", {})),
  }),
  mdi: defineCollection({
    loader: createIconLoader(iconifyLocalSource("mdi")),
  }),
  ri: defineCollection({
    loader: createIconLoader(
      iconifyLocalSource("ri", { allowed: ["aliens-fill"] }),
    ),
  }),
  bi: defineCollection({
    loader: createIconLoader(iconifyLocalSource("bi", { allowed: ["stars"] })),
  }),
  combined: defineCollection({
    loader: createIconLoader([
      iconifyLocalSource("fe", { allowed: ["activity"] }),
      iconifyLocalSource("ri", { allowed: ["star-fill"] }),
    ]),
  }),
};
