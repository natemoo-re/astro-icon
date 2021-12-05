# Astro Icon

A straight-forward `Icon` component for [Astro](https://astro.build).

`astro-icon` will automatically optimize icons with [`svgo`](https://github.com/svg/svgo) and inline them directly into your HTML—no extra build step, no spritesheet complexity, no cross-browser concerns! See ["A Pretty Good SVG Icon System"](https://css-tricks.com/pretty-good-svg-icon-system/#just-include-the-icons-inline) from CSS Tricks.

## Usage

1. Install `astro-icon`.

```bash
npm i astro-icon
# or
yarn add astro-icon
```

2. Add the following to your `astro.config.mjs` file. See [Issue #2](https://github.com/natemoo-re/astro-icon/issues/2).

```js
export default {
  vite: {
    ssr: {
      external: ["svgo"],
    },
  },
};
```

3. Create a directory inside of `src/` named `icons/`.
4. Add each desired icon as an individual `.svg` file to `src/icons/`
5. Reference a specific icon file using the `name` prop.

```astro
---
import { Icon } from 'astro-icon';
---

<!-- Loads the SVG in `/src/icons/filename.svg` -->
<Icon name="filename" />
```

6. Alternatively, if you need to reuse icons multiple times across a page, you can use the `Sprite` and `SpriteSheet` components. These leverage [`<use>`](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/use) internally.

```astro
---
import { Sprite, SpriteSheet } from 'astro-icon';
---

<!-- Uses the sprite from `/src/icons/filename.svg` -->
<Sprite name="filename" />

<!-- Required ONCE per page, creates `<symbol>` for each icon -->
<SpriteSheet />
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

`<Icon>` requires the `name` prop to reference a specific icon.

`<Icon>` optionally accepts the `optimize` prop as a boolean. Defaults to `true`. In the future it will control `svgo` options.

`<Icon>` also accepts any global HTML attributes and `aria` attributes. They will be forwarded to the rendered `<svg>` element.

See the [`Props.ts`](./lib/Props.ts) file for more details.
