# astro-icon

Render SVG icons in [Astro](https://astro.build) as inline `<svg>` elements, with full TypeScript autocomplete for every icon name.

astro-icon reads icons through Astro's [content layer](https://docs.astro.build/en/guides/content-collections/): a build-time collection for icons you know ahead of time, or a live collection for icons you resolve per request. It ships loaders for local `.svg` files and [Iconify](https://iconify.design) icon sets, and you can write your own loader for any other source.

- [Installation](#installation)
- [Quick start](#quick-start)
- [The `<Icon>` component](#the-icon-component)
- [Styling icons](#styling-icons)
- [Local icons](#local-icons)
- [Iconify icons](#iconify-icons)
- [Deduping repeated icons with `<Sprite>`](#deduping-repeated-icons-with-sprite)
- [Resolving icons per request with `<LiveIcon>`](#resolving-icons-per-request-with-liveicon)
- [Bringing your own icon source](#bringing-your-own-icon-source)
- [Shipping icons from a library](#shipping-icons-from-a-library)
- [Using icons in framework components](#using-icons-in-framework-components)
- [Upgrading from v1](#upgrading-from-v1)
- [Contributing](#contributing)
- [Changelog](#changelog)

## Installation

Install the package with your package manager:

```sh
npm install astro-icon
```

astro-icon isn't an Astro integration, so you don't add it to `integrations` in `astro.config.mjs`. Instead, you define one or more icon collections in `src/content.config.ts`, the same way you'd define any other content collection.

Then reference the icons astro-icon generates for you by adding this line to `src/env.d.ts`:

```ts
/// <reference path="../.astro/astro-icon.d.ts" />
```

This gives `<Icon name="...">` autocomplete for every icon in your collections, `<LiveIcon collection="...">` autocomplete for every live collection, and a type error for a name that doesn't exist. It updates the first time you run `astro sync`, `astro dev`, or `astro build`, so autocomplete won't show your icons until you've run one of those at least once.

## Quick start

Every collection is `createIconLoader` plus one or more `IconSource`s: `iconifyLocalSource` for an [Iconify icon set](https://icon-sets.iconify.design/), or `localSource` for a directory of your own `.svg` files:

```ts
// src/content.config.ts
import { defineCollection } from "astro:content";
import {
  createIconLoader,
  iconifyLocalSource,
  localSource,
} from "astro-icon/loaders";

export const collections = {
  // Renders any icon from Material Design Icons: <Icon name="mdi:home" />
  mdi: defineCollection({
    loader: createIconLoader(iconifyLocalSource("mdi")),
  }),
  // Renders a local file at src/icons/logo.svg: <Icon name="logo" />
  icons: defineCollection({ loader: createIconLoader(localSource()) }),
};
```

Then render an icon with the `<Icon>` component:

```astro
---
import { Icon } from "astro-icon/components";
---

<Icon name="mdi:home" />
<Icon name="logo" />
```

`<Icon>` resolves the icon at build time and inlines it as a standalone `<svg>`, with no client-side JavaScript.

## The `<Icon>` component

```ts
interface Props extends HTMLAttributes<"svg"> {
  name: IconName;
  title?: string;
  desc?: string;
  size?: number | string;
  width?: number | string | null;
  height?: number | string | null;
}
```

- `name` is `"collection:icon"` for any collection you define, or a bare icon name if you have a collection named `icons`, as in the example above.
- `title` and `desc` add an accessible `<title>` and `<desc>` inside the `<svg>`.
- `size` sets both `width` and `height` at once, and takes priority over either if you set both. Set `width` and `height` individually to render a non-square icon.
- By default, `<Icon>` renders with `width`/`height` set from the icon's intrinsic size. Pass `width={null}`/`height={null}` to omit the attribute entirely, e.g. to size the icon from CSS instead.

`<Icon>` also accepts any global HTML and `aria-*` attribute, and forwards it to the rendered `<svg>`.

By default, `<Icon>` renders as decorative: `aria-hidden="true"`, invisible to assistive tech. That's the common case, since most icons sit next to visible text or inside an already-labeled control. Set `title`, `desc`, or your own `aria-label`, `aria-labelledby`, `aria-description`, or `aria-describedby` to render it instead as a labeled, standalone graphic:

```astro
<!-- Decorative: assistive tech skips it, the button's own label is enough -->
<button><Icon name="mdi:close" /> Close</button>

<!-- Labeled: title becomes the icon's accessible name -->
<Icon name="mdi:warning" title="Warning" />
```

## Styling icons

Every rendered icon carries a `data-icon` attribute set to its `name` prop, so you can target it in CSS without adding a class yourself:

```astro
---
import { Icon } from "astro-icon/components";
---

<style>
  [data-icon] {
    color: blue;
  }
  [data-icon="mdi:heart"] {
    color: red;
  }
</style>

<Icon name="mdi:home" />
<!-- blue -->
<Icon name="mdi:heart" />
<!-- red -->

<!-- Or pass a class directly, e.g. with Tailwind -->
<Icon name="mdi:heart" class="text-red-500" />
```

An icon's `fill` or `stroke` only responds to CSS `color` if the source SVG uses `currentColor` instead of a hardcoded color. Most Iconify icon sets do this by default - their maintainers clean up each icon before publishing it. Local, hand-authored `.svg` files usually haven't been through that step:

```svg
<!-- Won't respond to [data-icon] { color: ... } -->
<svg viewBox="0 0 24 24"><path fill="#000" d="..." /></svg>

<!-- Will -->
<svg viewBox="0 0 24 24"><path fill="currentColor" d="..." /></svg>
```

`localSource()` never rewrites a file's colors for you - only you can tell a deliberately-colored logo apart from a UI glyph that just hasn't been converted, and guessing wrong silently changes what ships. What it does do: the first time each icon is actually read (initial sync, or a later `add`/`change` while watching in dev), if it looks like a single-color glyph (no `currentColor` anywhere, and no more than one distinct explicit `fill`/`stroke`) that would benefit, it logs a warning naming it - so the fix is one build away from being found instead of a support issue away. Multi-color icons (two or more distinct explicit colors, read as a deliberate graphic) are never flagged.

Fix it by editing the `.svg` file directly, or convert every icon in a collection at once with `svgo()`'s `convertColors` override:

```ts
import { svgo, defaultOverrides } from "astro-icon/optimize";

icons: defineCollection({
  loader: createIconLoader(
    localSource("src/icons", {
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
```

If `[data-icon] { color: ... }` isn't working, your source SVG almost certainly hardcodes a `fill`/`stroke` instead of using `currentColor` - check the build output for the warning above, or open the raw `.svg` file.

## Local icons

`localSource()` (from `astro-icon/loaders`, fed into `createIconLoader`) is an `IconSource` backed by a directory of local `.svg` files, `src/icons/` by default. `createIconLoader` watches it in dev: add, edit, or remove a file, and the collection updates without a server restart.

```ts
// src/content.config.ts
import { defineCollection } from "astro:content";
import { createIconLoader, localSource } from "astro-icon/loaders";

export const collections = {
  icons: defineCollection({ loader: createIconLoader(localSource()) }),
};
```

A file's path relative to the directory, without its extension, becomes its icon name. Subdirectories join with `/`: `src/icons/logos/deno.svg` becomes `<Icon name="logos/deno" />`.

Pass a different directory as the first argument:

```ts
icons: defineCollection({
  loader: createIconLoader(localSource("src/assets/icons")),
}),
```

A relative string like that resolves against your project's root, however `content.config.ts` was invoked - `localSource` figures that out from the loader itself, so you don't need to compute a path yourself. (The one exception is bundling icons _inside_ a package for consumers to import - see [Shipping icons from a library](#shipping-icons-from-a-library) for why that case takes a `URL` instead.)

Each sync logs how many icons it loaded and how long it took (e.g. `Loaded 42 icon(s) for the "icons" collection in 18ms`), so a slow build step is easy to attribute to icon loading versus everything else.

### Combining several local directories

`localSource()` only reads one directory, but it's a plain `IconSource` like any other - combine several by passing `createIconLoader` an array, the same way you'd combine any other sources. Say your own `src/icons/` plus a directory of icons vendored from another package:

```ts
// src/content.config.ts
import { defineCollection } from "astro:content";
import { createIconLoader, localSource } from "astro-icon/loaders";

export const collections = {
  icons: defineCollection({
    loader: createIconLoader([
      localSource("src/icons"),
      localSource("src/vendor-icons"),
    ]),
  }),
};
```

This still watches every composed directory in dev, add/edit/remove included - `localSource()` implements the same dev-watching `createIconLoader` uses for any watchable source, not just local ones.

**Keep icon names disjoint across composed local directories.** Like `mergeSources`, watching resolves a name to whichever source listed it first; editing a file in a later directory that shares a name with an earlier one still triggers a resync, it just re-resolves to the same, unchanged winner - so the edit will silently appear to do nothing. If two directories can genuinely overlap, give the later one an `icons: [...]` allowlist that excludes the shared names, or merge the directories instead.

## Iconify icons

`iconifyLocalSource` resolves icons from any [Iconify icon set](https://icon-sets.iconify.design/) installed locally as `@iconify-json/<pack>`. Pass it to `createIconLoader` to use it as a collection:

```sh
npm install -D @iconify-json/mdi
```

```ts
// src/content.config.ts
import { defineCollection } from "astro:content";
import { createIconLoader, iconifyLocalSource } from "astro-icon/loaders";

export const collections = {
  mdi: defineCollection({
    loader: createIconLoader(iconifyLocalSource("mdi")),
  }),
};
```

`iconifyLocalSource` never falls back to the network - it throws if the pack isn't installed. For a pack you'd rather not install (or a `<LiveIcon>` collection, where you can't know every icon name ahead of time), reach for `iconifyApiSource` instead, which resolves each requested icon individually from the public Iconify API:

```ts
import { createIconLoader, iconifyApiSource } from "astro-icon/loaders";

export const collections = {
  // The API only resolves icons you name explicitly, never the whole pack,
  // and it adds a network request per icon during your build.
  mdi: defineCollection({
    loader: createIconLoader(
      iconifyApiSource("mdi", { allowed: ["account", "home", "heart"] }),
    ),
  }),
};
```

Want "prefer a local install, fall back to the API"? Compose both with `mergeSources` - each icon is resolved by trying sources in order, first match wins:

```ts
import {
  createIconLoader,
  iconifyApiSource,
  iconifyLocalSource,
  mergeSources,
} from "astro-icon/loaders";

export const collections = {
  mdi: defineCollection({
    loader: createIconLoader(
      mergeSources([
        iconifyLocalSource("mdi", { allowed: ["account", "home", "heart"] }),
        iconifyApiSource("mdi", { allowed: ["account", "home", "heart"] }),
      ]),
    ),
  }),
};
```

Pass options as the second argument to either source. astro-icon doesn't run any optimization on its own, but `astro-icon/optimize` ships an `svgo()` helper ([SVGO](https://github.com/svg/svgo) is an optional peer dependency: `npm install svgo`) for the `optimize` option:

```ts
import { svgo } from "astro-icon/optimize";

export const collections = {
  mdi: defineCollection({
    loader: createIconLoader(
      iconifyLocalSource("mdi", {
        // Restrict the collection (and its generated types) to exactly these icons,
        // typed and autocompleted against "mdi"'s catalog once a sync has recorded it.
        allowed: ["account", "home", "heart"],
        // Transform each icon's raw SVG before astro-icon stores it.
        optimize: svgo(),
        // Turn a missing icon into a build error instead of a warning.
        strict: true,
      }),
    ),
  }),
};
```

`svgo()` with no arguments runs SVGO's `preset-default` with astro-icon's own `defaultOverrides` layered on top: mechanical cleanup only (whitespace, numeric precision, structurally-empty nodes), nothing that changes an icon's color or DOM shape (see `defaultOverrides`' own doc comment for the full list and reasoning). Pass SVGO's own config through as-is - a `plugins` option replaces the default list entirely rather than merging with it:

```ts
import { svgo } from "astro-icon/optimize";

optimize: svgo({ plugins: ["preset-default"] }); // SVGO's own untouched default
```

To keep most of astro-icon's defaults and adjust one plugin, build on `defaultOverrides` yourself instead of retyping the whole list:

```ts
import { svgo, defaultOverrides } from "astro-icon/optimize";

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
});
```

`optimize` also receives the icon's `collection` and `name`, which is useful for icons with internal `id` references (`<mask id="a">`, `url(#a)`, etc.). Rendering the same icon more than once outside `<Sprite>` (see [below](#deduping-repeated-icons-with-sprite)) duplicates those ids in the DOM, one copy per `<Icon>` use, which can make `id`-referencing features like masks and gradients resolve inconsistently. Prefix each icon's ids with its name to keep them unique:

```ts
import { svgo, defaultOverrides } from "astro-icon/optimize";

export const collections = {
  mdi: defineCollection({
    loader: createIconLoader(
      iconifyLocalSource("mdi", {
        optimize: (svg, { collection, name }) =>
          svgo({
            plugins: [
              {
                name: "prefixIds",
                params: { prefix: `${collection}-${name}` },
              },
              {
                name: "preset-default",
                params: { overrides: defaultOverrides },
              },
            ],
          })(svg, { collection, name }),
      }),
    ),
  }),
};
```

Combine several packs into one collection by passing `createIconLoader` an array of sources:

```ts
import { createIconLoader, iconifyLocalSource } from "astro-icon/loaders";

export const collections = {
  social: defineCollection({
    loader: createIconLoader([
      iconifyLocalSource("mdi", { allowed: ["github"] }),
      iconifyLocalSource("simple-icons", { allowed: ["discord"] }),
    ]),
  }),
};
```

Like a local collection, each collection's sync logs its icon count and duration (e.g. `Loaded 3 icon(s) for the "social" collection in 210ms`). Run with `--verbose` (or set Astro's `logLevel` to `"debug"`) for a finer-grained breakdown of how long listing icons took versus resolving/building them, so you can tell a slow local pack lookup apart from a slow Iconify API fallback, plus whether a pack resolved locally or from the API.

## Deduping repeated icons with `<Sprite>`

`<Icon>` always renders a standalone `<svg>`, with no deduping between repeated uses. If you render the same icon many times on a page, wrap those uses in `<Sprite>` to dedupe them into one `<symbol>` and many `<use>` elements:

```astro
---
import { Icon, Sprite } from "astro-icon/components";
---

<Sprite>
  <Icon name="mdi:star" />
  <Icon name="mdi:star" />
  <Icon name="mdi:star" />
</Sprite>
```

`<Sprite>` only affects `<Icon>` uses nested inside it. Anything outside a `<Sprite>` renders as before. Use one `<Sprite>` per page; a dev-only warning fires if a second one renders, since each dedupes independently and won't share `<symbol>`s with another.

`<Sprite>` requires a prerendered page (`export const prerender = true;`, or a project with `output: "static"`). It has to buffer and rewrite its slot's full HTML, which would otherwise break streaming on a server-rendered route.

## Resolving icons per request with `<LiveIcon>`

Use `<LiveIcon>` instead of `<Icon>` when you can't know your icon names ahead of time, such as a user-driven icon search. It resolves against a live collection at request time rather than at build time.

Live collections require Astro's `experimental.liveContentCollections` flag:

```ts
// astro.config.mjs
import { defineConfig } from "astro/config";

export default defineConfig({
  experimental: {
    liveContentCollections: true,
  },
});
```

Define one in `src/live.config.ts` with `createLiveIconLoader`, the live equivalent of `createIconLoader`:

```ts
// src/live.config.ts
import { defineLiveCollection } from "astro:content";
import {
  createLiveIconLoader,
  iconifyLocalSource,
} from "astro-icon/loaders/live";

export const collections = {
  mdi: defineLiveCollection({
    loader: createLiveIconLoader(iconifyLocalSource("mdi")),
  }),
};
```

For a pack you'd rather not install, `iconifyApiSource` (with no `allowed` option) resolves any icon name from the public Iconify API one at a time - exactly what a live collection needs, since its icon names aren't known ahead of time:

```ts
import {
  createLiveIconLoader,
  iconifyApiSource,
} from "astro-icon/loaders/live";

export const collections = {
  ph: defineLiveCollection({
    loader: createLiveIconLoader(iconifyApiSource("ph")),
  }),
};
```

```astro
---
import { LiveIcon } from "astro-icon/components";
---

<LiveIcon collection="mdi" icon="account" />
```

Unlike `<Icon>`, `<LiveIcon>` takes separate `collection` and `icon` props instead of one `name`. `collection` autocompletes against every live collection you define; `icon` stays a plain `string`, since a live collection's icon names resolve per request and aren't known at sync time. If an icon fails to resolve, `<LiveIcon>` logs a warning and renders nothing, rather than throwing and failing the whole page.

`<LiveIcon>` accepts the same `title`, `desc`, `size`, `width`, and `height` props as `<Icon>`, with the same decorative-by-default behavior described [above](#the-icon-component).

## Bringing your own icon source

Write your own `IconSource` to fetch icons from a design tool, a database, or an internal API, then pass it to `createIconLoader` (build time) or `createLiveIconLoader` (per request):

```ts
import { defineLiveCollection } from "astro:content";
import { parseIconSVG } from "astro-icon/loaders";
import { createLiveIconLoader } from "astro-icon/loaders/live";
import type { IconSource } from "astro-icon/loaders/live";

const mySource: IconSource = {
  name: "my-source",
  async getIcon(name) {
    const res = await fetch(`https://icons.example.com/${name}.svg`);
    if (!res.ok) throw new Error(`Icon "${name}" not found`);
    return parseIconSVG(await res.text(), {
      collection: "my-source",
      name,
      logger: { warn: console.warn },
    });
  },
  async listIcons() {
    const res = await fetch("https://icons.example.com/list.json");
    return res.json();
  },
};

export const collections = {
  custom: defineLiveCollection({ loader: createLiveIconLoader(mySource) }),
};
```

`getIcon` resolves one icon by name; throw a descriptive error if it can't be found or built. `listIcons` is required for a build collection and optional for a live one, where it enables `getLiveCollection()` and full autocomplete. `parseIconSVG` turns a raw `<svg>...</svg>` string into the shape astro-icon stores, deriving a `viewBox` if one is missing.

Implement `watch(watcher, report)` to opt a build-time source into dev watching, the same mechanism `localSource()` uses for a directory of files: register whatever paths the source depends on with `watcher`, and call `report({ type: "add" | "change" | "unlink", name })` whenever one of them changes - `createIconLoader` turns that into a surgical store update, re-resolving just that name instead of the whole collection. `createLiveIconLoader` never calls `watch` - a live collection resolves per request, so there's nothing to keep in sync.

## Shipping icons from a library

A collection is just the object you pass to `export const collections = { ... }` in `src/content.config.ts`, and `defineCollection({ loader })` is a plain, serializable value, not something tied to the project that created it. That means a library (a component library, a Starlight theme, an internal design system package) can build its own collection(s) and export them for consumers to add to their own `content.config.ts` with a spread, instead of asking every consumer to hand-write loader config:

```ts
// my-lib/src/icons.ts
import { defineCollection } from "astro:content";
import {
  createIconLoader,
  iconifyLocalSource,
  localSource,
} from "astro-icon/loaders";

export const myLibIcons = {
  // Namespace the key so it can't collide with a collection the consumer
  // defines themselves, e.g. their own "icons" for src/icons/.
  "my-lib-icons": defineCollection({
    loader: createIconLoader([
      // Bundle .svg files that ship inside the library's own package...
      localSource(new URL("../icons/", import.meta.url)),
      // ...and/or re-export a curated slice of an Iconify pack.
      iconifyLocalSource("mdi", { allowed: ["home", "account"] }),
    ]),
  }),
};
```

```ts
// consumer's src/content.config.ts
import { defineCollection } from "astro:content";
import { createIconLoader, localSource } from "astro-icon/loaders";
import { myLibIcons } from "my-lib/icons";

export const collections = {
  ...myLibIcons,
  // The consumer's own icons, defined the normal way.
  icons: defineCollection({ loader: createIconLoader(localSource()) }),
};
```

The consumer now renders both without adding a loader themselves: `<Icon name="my-lib-icons:home" />` and `<Icon name="logo" />`. Astro's content layer resolves each loader at build/dev time through the `LoaderContext` it passes in, including `config.root`, so the library's loader runs against the _consumer's_ project the same way any loader does. There's nothing extra to wire up, and typegen for the library's collection is written into the consumer's own `.astro/astro-icon.d.ts` alongside everything else.

Two things worth knowing when you're the library author:

- **Anchor bundled `.svg` files with a `URL`, not a plain string.** `localSource("../icons/")` resolves against the _consuming_ project's root, which is correct for a directory the consumer owns but wrong for one that ships inside your package - it would look for `../icons/` relative to whichever project imports you. `localSource(new URL("../icons/", import.meta.url))` always points at the icons next to your own source file instead, no matter who imports it.
- **Pick a collection key that won't collide.** Two collections can't share a key when their objects are spread together; prefix yours with your package name (`"my-lib-icons"`) rather than something generic like `"icons"`.

The same pattern works for a live collection: export an object of `defineLiveCollection({ loader: createLiveIconLoader(...) })` entries for a consumer to spread into their `src/live.config.ts`.

## Using icons in framework components

Astro's [`<slot>` element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/slot) lets you pass an `<Icon>` rendered in `.astro` into a framework component as a child, the same way you'd pass any other content. See Astro's [guide on framework components](https://docs.astro.build/en/guides/framework-components/) for details.

## Upgrading from v1

astro-icon v2 replaces the `icon()` Astro integration with content collection loaders. If you're on v1:

- Remove `icon()` from `integrations` in `astro.config.mjs`.
- Replace `config.include` with the `allowed` option on `iconifyLocalSource()`/`iconifyApiSource()` (see [Iconify icons](#iconify-icons)).
- Replace `config.iconDir` with `createIconLoader(localSource("your/dir"))`.
- Replace `config.svgoOptions` with the `optimize` option - astro-icon no longer runs any optimization by default. `svgo()` from `astro-icon/optimize` (see [Iconify icons](#iconify-icons)) covers the common case; for full control, `npm install svgo` and write your own `optimize` function.
- Define your collections in `src/content.config.ts` as shown in [Quick start](#quick-start), and add the `env.d.ts` reference from [Installation](#installation).

If you're upgrading from v0 to v1, see the [v1 upgrade guide](https://www.astroicon.dev/guides/upgrade/v1/) first.

## Contributing

You're welcome to submit an issue or PR!

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a history of changes to this package.
