import { defineCollection } from "astro:content";
import { createIconLoader, iconify, iconifySource, localIcons } from "astro-icon/loaders";

// Bare `<Icon name="..." />` resolves against a collection literally named
// "icons" - that's the convention, not something astro-icon enforces.
// `localIcons()` (defaulting to `src/icons/`) is the suggested way to
// populate it: drop an `.svg` file in, it's picked up automatically, same
// as Astro's built-in file-backed collections (e.g. markdown) - no need to
// restart the dev server. Subdirectories become part of the name -
// `src/icons/logos/deno.svg` is `"logos/deno"`.
//
// "ic"/"fe"/"ri"/"bi" are kept as separately-named collections (each
// iconify pack is its own collection, never a shared namespace) to
// demonstrate the explicit `collection:name` form. Each is restricted to
// the icons this demo actually uses via `icons: [...]` - a collection
// always loads (and types) everything its source(s) allow, so omitting
// `icons` here would pull in the entire pack (900+ icons for "ic" alone).
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
  // A single collection built from two different packs - each source is
  // restricted to the icon(s) it's allowed to contribute. `createIconLoader`
  // works with any `IconSource`, not just iconify packs - a custom npm
  // package's icons (or `localIcons()`'s local source) could sit in this
  // same list.
  combined: defineCollection({
    loader: createIconLoader([
      iconifySource("fe", { icons: ["activity"] }),
      iconifySource("ri", { icons: ["star-fill"] }),
    ]),
  }),
};
