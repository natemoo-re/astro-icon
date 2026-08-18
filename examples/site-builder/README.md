# Site builder example

One of four persona examples under `examples/` - see [PERSONA.md](../PERSONA.md) for who each one is and which use cases it covers.

**Who this is:** a blog/marketing site. Every page is prerendered. ~10 local icons, reused across a shared header/footer nav. This persona will never read a page about spritesheets and will never add sprite configuration - so this example doesn't add any.

**What to look at:**

- `astro.config.mjs` - just `integrations: [icon()]`. That single line is the entire opt-in.
- `src/content.config.ts` - one `localIcons()` collection, no options.
- `src/layouts/base.astro` - the same four icons render in both the header and footer of every page. Because they repeat *within a page*, they're automatically deduped into a `<symbol>` + `<use>` pair at build time.
- `src/pages/blog/hello-world.astro` - three icons (`calendar`, `heart`, `check`), each used once. Run `pnpm build` and check `dist/blog/hello-world/index.html`: they stay plain inline `<svg>` elements, because deduping a single occurrence would cost bytes, not save them. This is "do nothing" as a correct, automatic outcome - not a special case anyone configured.

**Try it:**

```sh
pnpm install
pnpm --filter example-site-builder build
pnpm --filter example-site-builder preview
```

Then view-source on any page. The nav icons appear once as `<symbol>` definitions near the top of `<body>`, referenced by `<use href="#ai:icons:home">` (etc.) wherever they're used; the once-only content icons on the blog post are ordinary `<svg>` elements with no `<use>` in sight.
