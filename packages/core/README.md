# Astro Icon

A straight-forward `Icon` component for [Astro](https://astro.build).

## Install `astro-icon`.

```bash
npm i astro-icon
# or
yarn add astro-icon
```

## Icon Packs

`astro-icon` automatically includes all of the most common icon packs, powered by [Iconify](https://iconify.design/)!

To browse supported icons, check the official [Icon Sets reference](https://icon-sets.iconify.design/) or visit [Icônes](https://icones.js.org/).

### Usage

**Icon** will inline the SVG directly in your HTML.

```astro
---
import { Icon } from 'astro-icon'
---

<!-- Automatically fetches and inlines Material Design Icon's "account" SVG -->
<Icon pack="mdi" name="account" />

<!-- Equivalent shorthand -->
<Icon name="mdi:account" />
```

**Sprite** will reference the SVG from a spritesheet via [`<use>`](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/use).

```astro
---
import { Sprite } from 'astro-icon'
---

<!-- Required ONCE per page as a parent of any <Sprite> components! Creates `<symbol>` for each icon -->
<!-- Can also be included in your Layout component! -->
<Sprite.Provider>
  <!-- Automatically fetches and inlines Material Design Icon's "account" SVG -->
  <Sprite pack="mdi" name="account" />

  <!-- Equivalent shorthand -->
  <Sprite name="mdi:account" />

</Sprite.Provider>
```

You may also create [Local Icon Packs](#local-icon-packs).

## Local Icons

By default, `astro-icon` supports custom local `svg` icons. They are optimized with [`svgo`](https://github.com/svg/svgo) automatically with no extra build step. See ["A Pretty Good SVG Icon System"](https://css-tricks.com/pretty-good-svg-icon-system/#just-include-the-icons-inline) from CSS Tricks.

### Usage

1. Create a directory inside of `src/` named `icons/`.
2. Add each desired icon as an individual `.svg` file to `src/icons/`
3. Reference a specific icon file using the `name` prop.

**Icon** will inline the SVG directly in your HTML.

```astro
---
import { Icon } from 'astro-icon';
---

<!-- Loads the SVG in `/src/icons/filename.svg` -->
<Icon name="filename" />
```

**Sprite** will reference the SVG from a spritesheet via [`<use>`](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/use).

```astro
---
import { Sprite } from 'astro-icon';
---

<!-- Required ONCE per page as a parent of any <Sprite> components! Creates `<symbol>` for each icon -->
<!-- Can also be included in your Layout component! -->
<Sprite.Provider>
  <!-- Uses the sprite from `/src/icons/filename.svg` -->
  <Sprite name="filename" />
</Sprite.Provider>
```

## Local Icon Packs

`astro-icon` supports custom local icon packs. These are also referenced with the `pack` and/or `name` props.

1. Create a directory inside of `src/` named `icons/`.
2. Create a JS/TS file with your `pack` name inside of that directory, eg `src/icons/my-pack.ts`
3. Use the `createIconPack` utility to handle most common situations.

```ts
import { createIconPack } from "astro-icon";

// Resolves `heroicons` dependency and reads SVG files from the `heroicons/outline` directory
export default createIconPack({ package: "heroicons", dir: "outline" });

// Resolves `name` from a remote server, like GitHub!
export default createIconPack({
  url: "https://raw.githubusercontent.com/radix-ui/icons/master/packages/radix-icons/icons/",
});
```

If you have custom constraints, you can always create the resolver yourself. Export a `default` function that resolves the `name` argument to an SVG string.

```ts
import { loadMyPackSvg } from "my-pack";
export default async (name: string): Promise<string> => {
  const svgString = await loadMyPackSvg(name);
  return svgString;
};
```

## Styling

Styling your `astro-icon` is straightforward. Any styles can be targeted to the `[astro-icon]` attribute selector. If you want to target a specific icon, you may target it by name using `[astro-icon="filename"]`.

```astro
---
import { Icon } from 'astro-icon';
---

<style lang="css">
    [astro-icon] {
        color: blue;
        /* OR */
        fill: blue;
    }
    [astro-icon="annotation"] {
        color: red;
        /* OR */
        fill: red;
    }
</style>

<Icon name="adjustment" /> <!-- will be blue -->
<Icon name="annotation" /> <!-- will be red -->
```

## Props

`<Icon>` and `<Sprite>` share the same interface.

The `name` prop references a specific icon. It is required.

The `optimize` prop is a boolean. Defaults to `true`. In the future it will control `svgo` options.

Both components also accepts any global HTML attributes and `aria` attributes. They will be forwarded to the rendered `<svg>` element.

See the [`Props.ts`](./packages/core/lib/Props.ts) file for more details.
