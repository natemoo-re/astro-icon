# Site builder example

One of four persona examples under `examples/` - see [PERSONA.md](../PERSONA.md) for who each one is and which use cases it covers.

**Who this is:** a blog/marketing site. Every page is prerendered. ~10 local icons, reused across a shared header/footer nav. This persona will never read past "Quick start" in the README - so this example doesn't add any configuration beyond it.

**What to look at:**

- `astro.config.mjs` - empty. astro-icon isn't an Astro integration, so there's nothing to add here.
- `src/content.config.ts` - one `localSource()` collection, no options: [**UC1**](../PERSONA.md#use-cases-ranked).
- `src/layouts/base.astro` - the same four icons render in both the header and footer of every page, each a plain, standalone `<svg>`.

**Try it:**

```sh
pnpm install
pnpm --filter example-site-builder build
pnpm --filter example-site-builder preview
```
