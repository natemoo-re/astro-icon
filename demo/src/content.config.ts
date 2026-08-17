import { defineCollection } from "astro:content";
import {
  createIconLoader,
  iconifyApiSource,
  iconifyLocalSource,
  localSource,
  mergeSources,
} from "astro-icon/loaders";
import { defaultOverrides, svgo } from "astro-icon/optimize";

// Each collection here exercises one loader/source composition, so /collections/ can show them
// side by side. Names describe what's being tested, not which pack backs it.
export const collections = {
  // localSource(): every .svg in src/icons/, watched in dev, run through SVGO.
  // "lock.svg" is deliberately authored without `currentColor` so this collection trips
  // localSource()'s "won't respond to CSS color" warning on every sync - see /optimize/.
  icons: defineCollection({
    loader: createIconLoader(localSource("src/icons", { optimize: svgo() })),
  }),

  // iconifyLocalSource() with no `allowed` allowlist: the whole installed pack (~14k icons).
  // Named "pack", not "mdi", because live.config.ts already has a live collection named "mdi"
  // and the two share one namespace.
  pack: defineCollection({ loader: createIconLoader(iconifyLocalSource("mdi")) }),

  // iconifyLocalSource() restricted to an explicit allowlist. Asking for anything outside
  // this list is an error, not a silent miss.
  allowlist: defineCollection({
    loader: createIconLoader(
      iconifyLocalSource("ic", {
        allowed: ["baseline-storage", "baseline-cloud-queue", "baseline-extension"],
      }),
    ),
  }),

  // createIconLoader([...]): two packs merged into one collection, each icon resolved by
  // trying sources in order.
  combined: defineCollection({
    loader: createIconLoader([
      iconifyLocalSource("fe", { allowed: ["activity"] }),
      iconifyLocalSource("bi", { allowed: ["stars"] }),
    ]),
  }),

  // mergeSources(): local-preferred, API-fallback. "mdi" is installed, so the API source never
  // runs - uninstall @iconify-json/mdi and this collection should still resolve.
  resilient: defineCollection({
    loader: createIconLoader(
      mergeSources([
        iconifyLocalSource("mdi", { allowed: ["home-outline", "cog-outline"] }),
        iconifyApiSource("mdi", { allowed: ["home-outline", "cog-outline"] }),
      ]),
    ),
  }),

  // localSource() composed with a pack: local .svg files and Iconify icons in one collection.
  mixed: defineCollection({
    loader: createIconLoader([
      localSource("src/icons", { icons: ["star"] }),
      iconifyLocalSource("ri", { allowed: ["star-fill"] }),
    ]),
  }),

  // The same lock.svg as `icons`, but with `convertColors: { currentColor: true }` layered onto
  // the default overrides - the fix the currentColor warning points at. Compare on /optimize/.
  lockFixed: defineCollection({
    loader: createIconLoader(
      localSource("src/icons", {
        icons: ["lock"],
        optimize: svgo({
          plugins: [
            {
              name: "preset-default",
              params: { overrides: { ...defaultOverrides, convertColors: { currentColor: true } } },
            },
          ],
        }),
      }),
    ),
  }),
};
