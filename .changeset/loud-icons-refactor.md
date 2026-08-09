---
"astro-icon": major
---

Rebuilt astro-icon on top of Astro's Content Layer instead of a custom Vite resolver.

- **Requires Astro 5.** The `astro-icon` integration and `virtual:astro-icon` module are removed. There is nothing to add to `integrations` anymore.
- **Each iconify pack is now its own content collection**, defined in `src/content.config.ts` with the new `iconify()` loader from `astro-icon/loaders`:
  ```ts
  import { defineCollection } from "astro:content";
  import { iconify } from "astro-icon/loaders";

  export const collections = {
    mdi: defineCollection({ loader: iconify("mdi") }),
  };
  ```
  `<Icon name="mdi:search" />` resolves the `mdi` collection's `search` entry. `<Icon name="search" />` (no prefix) resolves a collection literally named `icons` - that's just a naming convention, not something astro-icon enforces, so you must define a collection called `icons` yourself for bare names to work.
- **A collection is always exactly what its source(s) allow - restrict it with `icons: [...]`.** `iconify("mdi")` with no options loads (and types) the entire `mdi` pack, provided it's installed locally (the public Iconify API can only ever return specific icons you ask for, never "everything"). Pass `icons: ["account", "home"]` to restrict a pack to just those - a deliberate allowlist, not a scan-based guess, so loading and generated types are always the same set.
- **Everything is built on one primitive: `IconSource`** (`{ name, getIcon(name), listIcons?() }`) - `iconifySource(pack, options)` is the Iconify-backed one, and `iconify()` is just `iconifySource()` fed into `createIconLoader()`. Write your own `IconSource` for a non-Iconify pack, a custom npm package's icons, or any other API.
- **Combine multiple sources into one collection** by passing an array to `createIconLoader()` (or `createLiveIconLoader()` for a live collection) - each requested icon is resolved by trying sources in order, first match wins:
  ```ts
  import { defineCollection } from "astro:content";
  import { createIconLoader, iconifySource } from "astro-icon/loaders";

  export const collections = {
    icons: defineCollection({
      loader: createIconLoader([iconifySource("mdi", { icons: ["account"] }), myCustomSource]),
    }),
  };
  ```
  `iconify()` accepts an array of pack names too, for the common case of merging a few packs with the same options: `iconify(["mdi", "ic"], { icons: [...] })`.
- **New `<LiveIcon>` component**, backed by Astro's experimental live content collections. `astro-icon/loaders/live` exports `createLiveIconLoader(source)` plus `iconifyLive(pack, options)` built on top of it, so a live source isn't limited to Iconify - implement your own `IconSource` to back `<LiveIcon>` with a different pack format or API. Unlike `<Icon>`, `<LiveIcon>` always requires a `collection:name` value - there's no default collection.
  - If a source's `listIcons()` succeeds (e.g. `iconifyLive("mdi")` with `mdi` installed locally), its live collection is typed with the real union of icon names, same as a build collection. Only falls back to a plain `string` when the source can't enumerate itself - no `listIcons`, or it fails (e.g. an API-only pack with nothing installed locally). Since `LiveLoader`s aren't told their own collection name by Astro, this is keyed off `IconSource.name` - name your source the same as the collection key it's registered under (`iconifySource`/`iconifyLive` already do this, matching the pack name) for types to line up.
- **Local icons are back, as a proper `IconSource`.** `localIcons(dir?, options?)` (from `astro-icon/loaders`) loads every `.svg` under a directory (default `src/icons/`) - subdirectories become part of the name (`src/icons/logos/deno.svg` is `"logos/deno"`) - and watches it in dev, the same way Astro's built-in file-backed collections (e.g. markdown) do: add, edit, or remove a file and the collection picks it up with no dev server restart. This is the suggested default for the `icons` collection:
  ```ts
  icons: defineCollection({ loader: localIcons() }),
  ```
  `localSource(dir, options)` is the underlying `IconSource` if you want to combine local icons with other sources via `createIconLoader([...])`. Local icons update incrementally (`add`/`change`/`unlink` only touch the one affected entry) rather than reloading everything on every change - the same approach Astro's own built-in `glob()` loader takes.
- **Loaders follow the Content Loader API's documented conventions**: `createIconLoader()` (and everything built on it - `iconify()`, `localIcons()`) provides a default Zod schema for `getEntry().data`, and runs every entry through `parseData()` before storing it, so a schema you supply via `defineCollection({ loader, schema })` is actually applied and validated.
- **No more bundled SVGO.** Loaders accept an optional `optimize(svg, { collection, name })` function instead - a plain transform with no default and no dependency pulled in for you.
- **`viewBox` handling**: the source `viewBox` is used when present; otherwise one is derived from the icon's width/height, with a warning. Pass `strict: true` to a loader to turn that warning (and a few others - a source failing to provide/build a requested icon) into a build error instead.
- Name types are generated per-collection (`.astro/astro-icon/<kind>-<collection>.d.ts`), referenced from a single `.astro/astro-icon.d.ts` you point `src/env.d.ts` at.

A full migration guide for the docs site is tracked separately and not yet published.
