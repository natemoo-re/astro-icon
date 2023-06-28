# astro-icon

This **[Astro integration](https://docs.astro.build/en/guides/integrations-guide/)** provides a straight-forward `Icon` component for [Astro](https://astro.build).

- <strong>[Why Astro Icon](#why-astro-icon)</strong>
- <strong>[Installation](#installation)</strong>
- <strong>[Usage](#usage)</strong>
- <strong>[Configuration](#configuration)</strong>
- <strong>[Examples](#examples)</strong>
- <strong>[Migrating to v1](#migrating-to-v1)</strong>
- <strong>[Contributing](#contributing)</strong>
- <strong>[Changelog](#changelog)</strong>

## Why Astro Icon

## Installation

### Quick Install

Possibly coming soon!

<!--

The `astro add` command-line tool automates the installation for you. Run one of the following commands in a new terminal window. (If you aren't sure which package manager you're using, run the first command.) Then, follow the prompts, and type "y" in the terminal (meaning "yes") for each one.

```sh
# Using NPM
npx astro add icon
# Using Yarn
yarn astro add icon
# Using PNPM
pnpm astro add icon
```

If you run into any issues, [feel free to report them to us on GitHub](https://github.com/withastro/astro/issues) and try the manual installation steps below.

-->

### Manual Install

First, install the `astro-icon` package using your package manager. If you're using npm or aren't sure, run this in the terminal:

```sh
npm install astro-icon
```

Then, apply this integration to your `astro.config.*` file using the `integrations` property:

**`astro.config.mjs`**

```js ins={2} "icon()"
import { defineConfig } from "astro/config";
import icon from "astro-icon";

export default defineConfig({
  // ...
  integrations: [icon()],
});
```

## Usage

Astro Icon should be ready to go with zero config. The `Icon` component is provided and allows you to inline `svg`s directly into your HTML.

### Local Icons

By default, Astro Icon supports custom local `svg` icons. They are optimized with [`svgo`](https://github.com/svg/svgo) automatically with no extra build step. See ["A Pretty Good SVG Icon System"](https://css-tricks.com/pretty-good-svg-icon-system/#just-include-the-icons-inline) from CSS Tricks.

1. Create a directory inside of `src/` named `icons/`.
2. Add each desired icon as an individual `.svg` file to `src/icons/`
3. Reference a specific icon file using the `name` prop.

```astro
---
import { Icon } from 'astro-icon/components';
---

<!-- Loads the SVG in `/src/icons/filename.svg` -->
<Icon name="filename" />
```

## Iconify Icons

Astro Icon also supports Iconify out-of-the-box with minimal configuration. To use an icon set from Iconify follow the instructions below:

1. Find an Icon Set to use on the [Iconify Icon Sets website](https://icon-sets.iconify.design/)
2. Install the package (eg. `npm i -D @iconify-json/mdi`)
3. Add an entry to the `astro.config.mjs` file

**`astro.config.mjs`**

```js ins={2}
import { defineConfig } from "astro/config";
import icon from "astro-icon";

export default defineConfig({
  // ...
  integrations: [
    icon({
      include: {
        mdi: ["*"], // Loads entire Material Design Icon set
      },
    }),
  ],
});
```

4. Reference a specific icon using the `name` prop with (eg. `mdi:account`)

```astro
---
import { Icon } from 'astro-icon/components'
---

<!-- Automatically fetches and inlines Material Design Icon's "account" SVG -->
<Icon name="mdi:account" />
```

### Props

The `Icon` component allows these custom properties:

```ts
interface Props extends HTMLAttributes<"svg"> {
  /**
   * References a specific Icon
   */
  name: string;
  title?: string;
  size?: number;
  width?: number;
  height?: number;
}
```

The `Icon` also accepts any global HTML attributes and `aria` attributes. They will be forwarded to the rendered `<svg>` element.

See the [`Props.ts`](./packages/core/lib/Props.ts) file for more details.

### Styling

Styling your `astro-icon` is straightforward. Any styles can be targeted to the `[data-icon]` attribute selector. If you want to target a specific icon, you may target it by name using `[data-icon="filename"]`.

```astro
---
import { Icon } from 'astro-icon/components';
---

<style lang="css">
    [data-icon] {
        color: blue;
        /* OR */
        fill: blue;
    }
    [data-icon="annotation"] {
        color: red;
        /* OR */
        fill: red;
    }
</style>

<Icon name="adjustment" /> <!-- will be blue -->
<Icon name="annotation" /> <!-- will be red -->

<!-- Example using Tailwind to apply color -->
<Icon name="annotation" class="text-red-500" /> <!-- will be red-500 -->
```

### Using with Frameworks

Astro Icon can be used with other frameworks utilizing the [`slot` element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/slot). You can read more about how to use Slots in Astro here. [Passing Children to Framework Components](https://docs.astro.build/en/core-concepts/framework-components/#passing-children-to-framework-components)

## Configuration

### Configuring the Integration

The Astro Icon integration has its own options for controlling the `Icon` component. Change these in the `astro.config.mjs` file which is where your project's integration settings live.

#### config.include

If you want to use icon sets from Iconify, specify that set's name using this integration's `config.include` option. To specify including an entire pack use the wildcard `['*']`. Alternatively, loading individual icons is permitted as an array of those icon names.

**`astro.config.mjs`**

```js ins={2}
import { defineConfig } from "astro/config";
import icon from "astro-icon";

export default defineConfig({
  // ...
  integrations: [
    icon({
      include: {
        mdi: ["*"], // Loads entire Material Design Icon set
        // or
        mdi: ["account"], // Only loads the Material Design Icon's "account" SVG
      },
    }),
  ],
});
```

#### config.iconDir

If you want to use a different custom svg icon directory instead of the default `src/icons/`, specify that file path using `config.iconDir`

```js ins={2}
import { defineConfig } from "astro/config";
import icon from "astro-icon";

export default defineConfig({
  // ...
  integrations: [
    icon({
      iconDir: "src/images/icons",
    }),
  ],
});
```

#### config.svgoOptions

If you want to change the `svgo` options instead of using the defaults, specify the options using `config.svgoOptions`. Read more about the available [`svgo` options here](https://github.com/svg/svgo#configuration)

```js ins={2}
import { defineConfig } from "astro/config";
import icon from "astro-icon";

export default defineConfig({
  // ...
  integrations: [
    icon({
      svgoOptions: {
        multipass: true,
        plugins: [
          {
            name: "preset-default",
            params: {
              overrides: {
                // customize default plugin options
                inlineStyles: {
                  onlyMatchedOnce: false,
                },

                // or disable plugins
                removeDoctype: false,
              },
            },
          },
        ],
      },
    }),
  ],
});
```

## Examples

TODO: Examples

## Migrating to v1

TODO:

- sprite
- icon packs

## Contributing

You're welcome to submit an issue or PR!

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a history of changes to this integration.
