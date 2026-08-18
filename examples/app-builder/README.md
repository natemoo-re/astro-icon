# App builder example

One of four persona examples under `examples/` - see [PERSONA.md](../PERSONA.md) for who each one is and which use cases it covers.

**Who this is:** a dashboard/SaaS app, mostly SSR, with a ~30-icon design system pulled from an Iconify pack (`mdi`) plus a local brand mark. This is the persona sprites exist for - a prerender-only optimization wouldn't reach it.

**What to look at:**

- `astro.config.mjs` - `output: "server"` with the `@astrojs/node` adapter. `integrations: [icon()]` is the only sprite-related line.
- `src/pages/dashboard.astro` - no `export const prerender`, so it's SSR by default. Its table has 40 rows, each rendering the same three action icons (`mdi:eye`, `mdi:pencil`, `mdi:delete`) - **UC1, "same icon 40x on one page,"** the dominant case sprites are built for.
- `src/pages/login.astro` - opts into `export const prerender = true`. Same app, same `mdi` collection, different delivery: this page inlines its own sprite at build time instead of referencing the shared external asset.

**Try it:**

```sh
pnpm install
pnpm --filter example-app-builder build
pnpm --filter example-app-builder preview
```

Then:

1. View-source (not devtools - you want what the server actually sent) on `/dashboard`. Each of the 120 action-icon usages is a `<svg data-icon="mdi:eye"><use href="/_astro/mdi.<hash>.svg#ai:mdi:eye"/></svg>` (or `pencil`/`delete`), not an inlined icon body.
2. Look for the emitted asset itself in the build output (`dist/client/_astro/mdi.<hash>.svg`) - one `<symbol>` per referenced `mdi` icon, shared across every SSR page that needs it.
3. View-source on `/login`: no `<use>` referencing an external file. The `mdi:email`/`mdi:lock` icons there are either inline `<svg>` (used once) or a page-local `<symbol>`/`<use>` pair, entirely self-contained in that page's HTML - prerendered pages never fetch the shared asset.
