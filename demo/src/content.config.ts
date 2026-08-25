import {
  defineIconCollection,
  iconify,
  iconifyApi,
  localIcons,
} from "astro-icon/collections";
import { defaultOverrides, svgo } from "astro-icon/optimize";

// Each collection here exercises one source composition, so /collections/ can show them
// side by side. Names describe what's being tested, not which pack backs it.
export const collections = {
  // localIcons(): every .svg in src/icons/, watched in dev, run through SVGO.
  // "lock.svg" is deliberately authored without `currentColor` so this collection trips
  // localIcons()'s "won't respond to CSS color" warning on every sync - see /optimize/.
  icons: defineIconCollection(localIcons("src/icons", { optimize: svgo() })),

  // iconify() with no `allowed` allowlist: the whole installed pack (~14k icons).
  // Named "pack", not "mdi", because live.config.ts already has a live collection named "mdi"
  // and the two share one namespace.
  pack: defineIconCollection(iconify("mdi")),

  // iconify() restricted to an explicit allowlist. Asking for anything outside this list is a
  // build error, not a silent miss.
  allowlist: defineIconCollection(
    iconify("ic", {
      allowed: [
        "baseline-storage",
        "baseline-cloud-queue",
        "baseline-extension",
      ],
    }),
  ),

  // defineIconCollection([...]): two packs merged into one collection, each icon resolved by
  // trying sources in order.
  combined: defineIconCollection([
    iconify("fe", { allowed: ["activity"] }),
    iconify("bi", { allowed: ["stars"] }),
  ]),

  // iconifyApi() standalone: "ph" isn't installed, so each of these icons is fetched from
  // the public Iconify API at sync time. `allowed` is required in spirit here - an API source
  // can't list a whole pack, only resolve icons you name.
  apiOnly: defineIconCollection(
    iconifyApi("ph", { allowed: ["alien", "planet", "rocket-launch"] }),
  ),

  // An array is first-match-wins: local-preferred, API-fallback. "mdi" is installed, so the API
  // source never runs - uninstall @iconify-json/mdi and this collection should still resolve.
  resilient: defineIconCollection([
    iconify("mdi", { allowed: ["home-outline", "cog-outline"] }),
    iconifyApi("mdi", { allowed: ["home-outline", "cog-outline"] }),
  ]),

  // localIcons() composed with a pack: local .svg files and Iconify icons in one collection.
  mixed: defineIconCollection([
    localIcons("src/icons", { allowed: ["star"] }),
    iconify("ri", { allowed: ["star-fill"] }),
  ]),

  // The same lock.svg as `icons`, but with `convertColors: { currentColor: true }` layered onto
  // the default overrides - the fix the currentColor warning points at. Compare on /optimize/.
  lockFixed: defineIconCollection(
    localIcons("src/icons", {
      allowed: ["lock"],
      optimize: svgo({
        plugins: [
          {
            name: "preset-default",
            params: {
              overrides: {
                ...defaultOverrides,
                convertColors: { currentColor: true },
              },
            },
          },
        ],
      }),
    }),
  ),
};
