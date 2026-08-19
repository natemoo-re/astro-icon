---
"astro-icon": major
---

Rebuilt astro-icon on top of Astro's Content Layer instead of a custom Vite resolver.

- **Requires Astro 5.** The `astro-icon` integration and `virtual:astro-icon` module are removed. There is nothing to add to `integrations` anymore.
- **Each iconify pack is now its own content collection**, defined in `src/content.config.ts` with `createIconLoader` and the new `iconifyLocalSource()` from `astro-icon/loaders`:
  ```ts
  import { defineCollection } from "astro:content";
  import { createIconLoader, iconifyLocalSource } from "astro-icon/loaders";

  export const collections = {
    mdi: defineCollection({
      loader: createIconLoader(iconifyLocalSource("mdi")),
    }),
  };
  ```
  `<Icon name="mdi:search" />` resolves the `mdi` collection's `search` entry. `<Icon name="search" />` (no prefix) resolves a collection literally named `icons`, a naming convention rather than something astro-icon enforces, so you must define a collection called `icons` yourself for bare names to work.
- **A collection is always exactly what its source(s) allow, restrict it with `icons: [...]`.** `iconifyLocalSource("mdi")` with no options loads (and types) the entire `mdi` pack, provided it's installed locally. `iconifyApiSource("mdi", { icons: [...] })` resolves from the public Iconify API instead, which can only ever return specific icons you ask for, never "everything", so `icons` is required there. Compose both with `mergeSources` for "prefer local, fall back to the API." Pass `icons: ["account", "home"]` to restrict a pack to those two, a deliberate allowlist, not a scan-based guess, so loading and generated types are always the same set.
- **Everything is built on one primitive: `IconSource`** (`{ name, getIcon(name), listIcons?() }`). `iconifyLocalSource(pack, options)`/`iconifyApiSource(pack, options)` are the Iconify-backed ones, fed into `createIconLoader()`. Write your own `IconSource` for a non-Iconify pack, a custom npm package's icons, or any other API.
- **Combine multiple sources into one collection** by passing an array to `createIconLoader()` (or `createLiveIconLoader()` for a live collection). Each requested icon is resolved by trying sources in order, first match wins:
  ```ts
  import { defineCollection } from "astro:content";
  import { createIconLoader, iconifyLocalSource } from "astro-icon/loaders";

  export const collections = {
    icons: defineCollection({
      loader: createIconLoader([
        iconifyLocalSource("mdi", { icons: ["account"] }),
        myCustomSource,
      ]),
    }),
  };
  ```
- **New `<LiveIcon>` component**, backed by Astro's experimental live content collections. `astro-icon/loaders/live` exports `createLiveIconLoader(source)` plus `iconifyLocalSource`/`iconifyApiSource`, so a live source isn't limited to Iconify: implement your own `IconSource` to back `<LiveIcon>` with a different pack format or API. Unlike `<Icon>`, `<LiveIcon>` always requires a `collection:name` value; there's no default collection.
  - If a source's `listIcons()` succeeds (e.g. `iconifyLocalSource("mdi")` with `mdi` installed locally), its live collection is typed with the real union of icon names, same as a build collection. It falls back to a plain `string` only when the source can't enumerate itself: no `listIcons`, or it fails (e.g. `iconifyApiSource("ph")` with no `icons` option, resolving arbitrary icon names one at a time). Since `LiveLoader`s aren't told their own collection name by Astro, this is keyed off `IconSource.name`; name your source the same as the collection key it's registered under for types to line up.
- **Local icons are back, as a proper `IconSource`.** `localIcons(dir?, options?)` (from `astro-icon/loaders`) loads every `.svg` under a directory (default `src/icons/`). Subdirectories become part of the name (`src/icons/logos/deno.svg` is `"logos/deno"`), and it watches the directory in dev, the same way Astro's built-in file-backed collections (e.g. markdown) do: add, edit, or remove a file and the collection picks it up with no dev server restart. This is the suggested default for the `icons` collection:
  ```ts
  icons: defineCollection({ loader: localIcons() }),
  ```
  `localSource(dir, options)` is the underlying `IconSource` if you want to combine local icons with other sources via `createIconLoader([...])`. Local icons update incrementally (`add`/`change`/`unlink` only touch the one affected entry) rather than reloading everything on every change, the same approach Astro's own built-in `glob()` loader takes.
- **Loaders follow the Content Loader API's documented conventions**: `createIconLoader()` (and everything built on it, including `iconifyLocalSource()`/`iconifyApiSource()` and `localIcons()`) provides a default Zod schema for `getEntry().data`, and runs every entry through `parseData()` before storing it, so a schema you supply via `defineCollection({ loader, schema })` is actually applied and validated.
- **No more bundled SVGO.** Loaders accept an optional `optimize(svg, { collection, name })` function instead, a plain transform with no default and no dependency pulled in for you.
- **`viewBox` handling**: the source `viewBox` is used when present; otherwise one is derived from the icon's width/height, with a warning. Pass `strict: true` to a loader to turn that warning (and a few others, such as a source failing to provide/build a requested icon) into a build error instead.
- Name types are generated per-collection (`.astro/astro-icon/<kind>-<collection>.d.ts`), referenced from a single `.astro/astro-icon.d.ts` you point `src/env.d.ts` at.
- **`<Icon>` no longer dedupes on its own, and `is:inline` is gone.** `<Icon>` always renders a plain, standalone `<svg>` now. To dedupe repeated icons into one `<symbol>` + many `<use>`s, wrap them in the new `<Sprite>` component instead:
  ```astro
  ---
  import { Icon, Sprite } from "astro-icon/components";
  ---

  <Sprite>
    <Icon name="mdi:home" />
    <Icon name="mdi:home" />
  </Sprite>
  ```
  Only `<Icon>` usages nested inside a `<Sprite>` are affected: nothing outside it is ever deduped, so there's no per-icon flag to remember. Deduping only works on prerendered pages; on a server-rendered route `<Sprite>` falls back to rendering its children untouched (each `<Icon>` as its own standalone `<svg>`, same as not using `<Sprite>` at all) instead of throwing, with a dev-only warning.

A full migration guide for the docs site is tracked separately and not yet published.
