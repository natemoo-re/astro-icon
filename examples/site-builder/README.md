# Site builder example

One of four persona examples under `examples/` - see [PERSONA.md](../PERSONA.md) for who each one is and which use cases it covers.

**Who this is:** a blog/marketing/portfolio site. Every page is prerendered. ~20 local icons, reused across nav, footer, and page content. This persona will never read past "Quick start" in the README - so this example doesn't add any configuration beyond it.

This app is the official [Astro Portfolio starter](https://github.com/withastro/astro/tree/latest/examples/portfolio), unchanged except for its icons: the starter's hand-rolled `Icon.astro` + `IconPaths.ts` pair is replaced by astro-icon, with the same Phosphor icons checked in as plain `.svg` files. The rendered site is identical.

**What changed from the starter (and what to look at):**

- `src/icons/*.svg` - the starter's `IconPaths.ts` strings, as ordinary `.svg` files. Adding an icon is now "drop a file in this directory" instead of hand-editing path data into a TypeScript module.
- `src/content.config.ts` - one added line: an `icons` collection from `localSource()` with every default left alone: [**UC1**](../PERSONA.md#use-cases-ranked).
- `src/components/Icon.astro` and `IconPaths.ts` - deleted. Call sites import `Icon` from `astro-icon/components` and pass `name` instead of `icon`.
- `src/components/Nav.astro` - the social-links array is typed with `IconName` (from `astro-icon`), so a typo'd icon name is a type error where the link is defined, with autocomplete across the whole collection.
- `src/layouts/BaseLayout.astro` + `src/styles/global.css` - the starter inlined a `<linearGradient>` per gradient icon with a random id; here one shared def in the layout plus a `.gradient-icon` class does the same job, since every icon shares the same 256x256 viewBox.
- `src/content.config.ts` - the `work` collection's frontmatter schema gains an `icon` field, typed with `z.enum(...)` against the same filenames `localSource()` resolves: [**UC3**](../PERSONA.md#use-cases-ranked). A typo'd icon name in a project's Markdown frontmatter is a sync-time error, not a blank icon discovered on the rendered page. `src/components/PortfolioPreview.astro` renders it on each work card.

**Try it:**

```sh
pnpm install
pnpm --filter example-site-builder build
pnpm --filter example-site-builder preview
```
