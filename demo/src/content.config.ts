import {
  defineIconCollection,
  iconify,
  localSvg,
} from "astro-icon/collections";

// Each pack is restricted to the icons this demo uses; omitting `allowed` would load the entire pack.
export const collections = {
  icons: defineIconCollection(localSvg()),
  ic: defineIconCollection(
    iconify("ic", {
      allowed: [
        "baseline-account-box",
        "baseline-directions-run",
        "outline-star",
      ],
    }),
  ),
  fe: defineIconCollection(iconify("fe", {})),
  mdi: defineIconCollection(iconify("mdi")),
  ri: defineIconCollection(iconify("ri", { allowed: ["aliens-fill"] })),
  bi: defineIconCollection(iconify("bi", { allowed: ["stars"] })),
  combined: defineIconCollection([
    iconify("fe", { allowed: ["activity"] }),
    iconify("ri", { allowed: ["star-fill"] }),
  ]),
};
