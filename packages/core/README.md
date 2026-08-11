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

This gives `<Icon name="...">` and `<LiveIcon name="...">` autocomplete for every icon in your collections, and a type error for a name that doesn't exist. It updates the first time you run `astro sync`, `astro dev`, or `astro build`, so autocomplete won't show your icons until you've run one of those at least once.

## Quick start

Define a collection with the `iconify` loader for an [Iconify icon set](https://icon-sets.iconify.design/), or `localIcons` for a directory of your own `.svg` files:

```ts
// src/content.config.ts
import { defineCollection } from "astro:content";
import { iconify, localIcons } from "astro-icon/loaders";

export const collections = {
  // Renders any icon from Material Design Icons: <Icon name="mdi:home" />
  mdi: defineCollection({ loader: iconify("mdi") }),
  // Renders a local file at src/icons/logo.svg: <Icon name="logo" />
  icons: defineCollection({ loader: localIcons() }),
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
  width?: number | string;
  height?: number | string;
}
```

- `name` is `"collection:icon"` for any collection you define, or a bare icon name if you have a collection named `icons`, as in the example above.
- `title` and `desc` add an accessible `<title>` and `<desc>` inside the `<svg>`.
- `size` sets both `width` and `height` at once, and takes priority over either if you set both. Set `width` and `height` individually to render a non-square icon.

`<Icon>` also accepts any global HTML and `aria-*` attribute, and forwards it to the rendered `<svg>`.

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

<Icon name="mdi:home" /> <!-- blue -->
<Icon name="mdi:heart" /> <!-- red -->

<!-- Or pass a class directly, e.g. with Tailwind -->
<Icon name="mdi:heart" class="text-red-500" />
```

An icon's `fill` or `stroke` only responds to CSS `color` if the source SVG uses `currentColor`. Most Iconify icon sets do this by default; for your own `.svg` files, replace hardcoded colors with `currentColor` yourself, or strip them with an `optimize` function (see [Iconify icons](#iconify-icons)).

## Local icons

`localIcons()` reads every `.svg` file in a directory, `src/icons/` by default, and watches it in dev: add, edit, or remove a file, and the collection updates without a server restart.

```ts
// src/content.config.ts
import { defineCollection } from "astro:content";
import { localIcons } from "astro-icon/loaders";

export const collections = {
  icons: defineCollection({ loader: localIcons() }),
};
```

A file's path relative to the directory, without its extension, becomes its icon name. Subdirectories join with `/`: `src/icons/logos/deno.svg` becomes `<Icon name="logos/deno" />`.

Pass a different directory as the first argument:

```ts
icons: defineCollection({ loader: localIcons("src/assets/icons") }),
```

Each sync logs how many icons it loaded and how long it took (e.g. `Loaded 42 icon(s) from "icons" in 18ms`), so a slow build step is easy to attribute to icon loading versus everything else.

## Iconify icons

`iconify()` resolves icons from any [Iconify icon set](https://icon-sets.iconify.design/), preferring a locally installed pack and falling back to the public Iconify API for icons you request by name.

```sh
npm install -D @iconify-json/mdi
```

```ts
// src/content.config.ts
import { defineCollection } from "astro:content";
import { iconify } from "astro-icon/loaders";

export const collections = {
  mdi: defineCollection({ loader: iconify("mdi") }),
};
```

Install the pack for production. The public API only resolves icons you name explicitly, never the whole set, and it adds a network request during your build. Without a local install, `iconify()` still works in dev and in production, as long as you list every icon you use with the `icons` option below.

Pass options as the second argument. This example also plugs in [SVGO](https://github.com/svg/svgo) (`npm install svgo`) to optimize each icon, since astro-icon doesn't run any optimization on its own:

```ts
import { optimize } from "svgo";

export const collections = {
  mdi: defineCollection({
    loader: iconify("mdi", {
      // Restrict the collection (and its generated types) to exactly these icons,
      // instead of the whole pack. Useful for a design system's approved icon set.
      // Once a previous sync has recorded "mdi"'s catalog, each name here is
      // autocompleted and type-checked against it, and a literal duplicate is
      // a type error; both fall back to a plain string until that's happened.
      icons: ["account", "home", "heart"],
      // Transform each icon's raw SVG before astro-icon stores it.
      optimize: (svg) => optimize(svg).data,
      // Turn a missing icon or pack into a build error instead of a warning.
      strict: true,
    }),
  }),
};
```

Combine several packs into one collection with `createIconLoader` and `iconifySource`:

```ts
import { createIconLoader, iconifySource } from "astro-icon/loaders";

export const collections = {
  social: defineCollection({
    loader: createIconLoader([
      iconifySource("mdi", { icons: ["github"] }),
      iconifySource("simple-icons", { icons: ["discord"] }),
    ]),
  }),
};
```

Like `localIcons()`, each collection's sync logs its icon count and duration (e.g. `Loaded 3 icon(s) from "mdi" for the "social" collection in 210ms (list: 5ms, resolve: 205ms)`), splitting out how long listing icons took from how long resolving/building them took - handy for telling apart a slow local pack lookup from a slow Iconify API fallback. Run with `--verbose` (or set Astro's `logLevel` to `"debug"`) for finer-grained timing, including whether a pack resolved locally or from the API.

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

Define one in `src/live.config.ts` with `iconifyLive`, the live equivalent of `iconify()`:

```ts
// src/live.config.ts
import { defineLiveCollection } from "astro:content";
import { iconifyLive } from "astro-icon/loaders/live";

export const collections = {
  mdi: defineLiveCollection({ loader: iconifyLive("mdi") }),
};
```

```astro
---
import { LiveIcon } from "astro-icon/components";
---

<LiveIcon name="mdi:account" />
```

Unlike `<Icon>`, `<LiveIcon>`'s `name` always requires the `"collection:icon"` form, since live collections have no default. If an icon fails to resolve, `<LiveIcon>` logs a warning and renders nothing, rather than throwing and failing the whole page.

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

## Shipping icons from a library

A collection is just the object you pass to `export const collections = { ... }` in `src/content.config.ts`, and `defineCollection({ loader })` is a plain, serializable value, not something tied to the project that created it. That means a library — a component library, a Starlight theme, an internal design system package — can build its own collection(s) and export them for consumers to add to their own `content.config.ts` with a spread, instead of asking every consumer to hand-write loader config:

```ts
// my-lib/src/icons.ts
import { defineCollection } from "astro:content";
import { createIconLoader, iconifySource, localSource } from "astro-icon/loaders";

export const myLibIcons = {
  // Namespace the key so it can't collide with a collection the consumer
  // defines themselves, e.g. their own "icons" for src/icons/.
  "my-lib-icons": defineCollection({
    loader: createIconLoader([
      // Bundle .svg files that ship inside the library's own package...
      localSource(new URL("../icons/", import.meta.url)),
      // ...and/or re-export a curated slice of an Iconify pack.
      iconifySource("mdi", { icons: ["home", "account"] }),
    ]),
  }),
};
```

```ts
// consumer's src/content.config.ts
import { defineCollection } from "astro:content";
import { localIcons } from "astro-icon/loaders";
import { myLibIcons } from "my-lib/icons";

export const collections = {
  ...myLibIcons,
  // The consumer's own icons, defined the normal way.
  icons: defineCollection({ loader: localIcons() }),
};
```

The consumer now renders both without adding a loader themselves: `<Icon name="my-lib-icons:home" />` and `<Icon name="logo" />`. Astro's content layer resolves each loader at build/dev time through the `LoaderContext` it passes in, including `config.root`, so the library's loader runs against the *consumer's* project the same way any loader does — there's nothing extra to wire up, and typegen for the library's collection is written into the consumer's own `.astro/astro-icon.d.ts` alongside everything else.

Two things worth knowing when you're the library author:

- **Use `localSource`, not `localIcons()`, for bundled `.svg` files.** `localIcons(dir)` resolves `dir` against the *consuming* project's root (`config.root`), which is correct for a directory the consumer owns but wrong for one that ships inside your package. `localSource` takes a `URL` and resolves it directly, so `localSource(new URL("../icons/", import.meta.url))` always points at the icons next to your own source file, no matter who imports it. Wrap it in `createIconLoader([...])` to get a `Loader` you can hand to `defineCollection`.
- **Pick a collection key that won't collide.** Two collections can't share a key when their objects are spread together; prefix yours with your package name (`"my-lib-icons"`) rather than something generic like `"icons"`.

The same pattern works for a live collection: export an object of `defineLiveCollection({ loader: createLiveIconLoader(...) })` entries for a consumer to spread into their `src/live.config.ts`.

## Using icons in framework components

Astro's [`<slot>` element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/slot) lets you pass an `<Icon>` rendered in `.astro` into a framework component as a child, the same way you'd pass any other content. See Astro's [guide on framework components](https://docs.astro.build/en/guides/framework-components/) for details.

## Upgrading from v1

astro-icon v2 replaces the `icon()` Astro integration with content collection loaders. If you're on v1:

- Remove `icon()` from `integrations` in `astro.config.mjs`.
- Replace `config.include` with the `icons` option on `iconify()` or `iconifySource()`.
- Replace `config.iconDir` with `localIcons("your/dir")`.
- Replace `config.svgoOptions` with an `optimize` function that runs SVGO yourself; astro-icon no longer bundles SVGO or runs any optimization by default.
- Define your collections in `src/content.config.ts` as shown in [Quick start](#quick-start), and add the `env.d.ts` reference from [Installation](#installation).

If you're upgrading from v0 to v1, see the [v1 upgrade guide](https://www.astroicon.dev/guides/upgrade/v1/) first.

## Contributing

You're welcome to submit an issue or PR!

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a history of changes to this package.
