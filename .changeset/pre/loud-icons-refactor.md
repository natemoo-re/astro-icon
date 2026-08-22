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
- **Local icons are back, as a proper `IconSource`.** `localSource(dir?, options?)` (from `astro-icon/loaders`, fed into `createIconLoader`) loads every `.svg` under a directory (default `src/icons/`). Subdirectories become part of the name (`src/icons/logos/deno.svg` is `"logos/deno"`), and it watches the directory in dev, the same way Astro's built-in file-backed collections (e.g. markdown) do: add, edit, or remove a file and the collection picks it up with no dev server restart. This is the suggested default for the `icons` collection:
  ```ts
  icons: defineCollection({ loader: createIconLoader(localSource()) }),
  ```
  There's no separate `localIcons()` wrapper - `localSource` is a plain `IconSource` like any other, so combining several local directories (or a local directory with any other kind of source) is just `createIconLoader([localSource("src/icons"), localSource("src/vendor-icons"), ...])`, all watched. A relative directory string resolves against the project root automatically (via `IconSource.resolveRoot`, below), the same as the old `localIcons(dir)` did; pass a `URL` instead (`localSource(new URL("../icons/", import.meta.url))`) to anchor a directory bundled inside your own package instead of the consumer's root. Local icons update incrementally (`add`/`change`/`unlink` only touch the one affected entry) rather than reloading everything on every change, the same approach Astro's own built-in `glob()` loader takes.
- **Any `IconSource` can opt into dev watching**, not just local ones: implement `watch(watcher, report)` and `createIconLoader` wires it up alongside every other watchable source in the collection, calling `report({ type, name })` to trigger a surgical, single-icon update instead of a full resync. Composing sources with overlapping icon names still shadows by order (same as `getIcon`/`mergeSources` always have); watching doesn't change that, so a shadowed source's edits won't visibly do anything.
- **A source can also opt into `IconSource.resolveRoot(root)`**, called once before anything else whenever the loader actually has a project root to give it. `localSource` is the one built-in user of it: it's normally constructed eagerly in `content.config.ts`, before Astro's `config.root` exists, so a plain relative directory string (`localSource("src/icons")`) would otherwise resolve against `process.cwd()` at each file read - only sometimes the project root (`astro build --root <dir>` invoked from elsewhere is a common case where it isn't). `resolveRoot` lets it anchor correctly once `createIconLoader`/`createLiveIconLoader` can tell it where the project actually is.
- **Loaders follow the Content Loader API's documented conventions**: `createIconLoader()` (and every source built on it, including `iconifyLocalSource()`/`iconifyApiSource()` and `localSource()`) provides a default Zod schema for `getEntry().data`, and runs every entry through `parseData()` before storing it, so a schema you supply via `defineCollection({ loader, schema })` is actually applied and validated.
- **No more bundled SVGO.** Loaders accept an optional `optimize(svg, { collection, name })` function instead, a plain transform with no default and no dependency pulled in for you.
- **`viewBox` handling**: the source `viewBox` is used when present; otherwise one is derived from the icon's width/height, with a warning. Pass `strict: true` to a loader to turn that warning (and a few others, such as a source failing to provide/build a requested icon) into a build error instead.
- Name types are generated per-collection (`.astro/astro-icon/<kind>-<collection>.d.ts`), referenced from a single `.astro/astro-icon.d.ts` you point `src/env.d.ts` at.
- **`<Icon>` no longer dedupes repeated icons, and `is:inline` is gone.** Every `<Icon>` renders a plain, standalone `<svg>`. v1 collapsed repeated icons into one `<symbol>` plus many `<use>` elements; v2 doesn't, in either direction - there's no per-icon flag and no wrapper component to reach for.

  Compression is why. Repeated identical icon bodies are exactly what gzip and brotli are best at, so the sheet that looks smaller in raw bytes usually isn't smaller over the wire until an icon repeats dozens of times on one page - while `<symbol>`/`<use>` costs you real things unconditionally: CSS can't style into a `<use>`'s referenced content, and a `<use>` breaks if the element it points at is removed or navigated away from.

  If a specific page really does repeat one icon enough to matter, build a sheet for it yourself - `getEntry("icons", "home")` gives you the `viewBox` and `body` to put in a `<symbol>`.

A full migration guide for the docs site is tracked separately and not yet published.
