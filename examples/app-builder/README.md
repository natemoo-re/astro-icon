# App builder example

One of four persona examples under `examples/` - see [PERSONA.md](../PERSONA.md) for who each one is and which use cases it covers.

**Who this is:** a dashboard/SaaS app, mostly SSR, with a ~30-icon design system pulled from an Iconify pack (`mdi`) plus a local brand mark.

**What to look at:**

- `astro.config.mjs` - `output: "server"` with the `@astrojs/node` adapter. Nothing astro-icon-specific in here at all.
- `src/content.config.ts` - **[UC2](../PERSONA.md#use-cases-ranked)**: the `mdi` collection's `allowed: [...]` list curates a 7,000+ icon pack down to the ~30 this app actually uses, so both the sync and the generated types stay scoped to what's really rendered.
- `src/pages/dashboard.astro` - no `export const prerender`, so it's SSR by default. Its table has 40 rows, each rendering the same three action icons (`mdi:eye`, `mdi:pencil`, `mdi:delete`) - 120 icon usages, each an independent inline `<svg>`, resolved fresh per request.
- `src/pages/login.astro` - opts into `export const prerender = true`. Same `mdi`/`brand` collections as the dashboard, resolved at build time instead of per request - the collection doesn't care which.

**Try it:**

```sh
pnpm install
pnpm --filter example-app-builder build
pnpm --filter example-app-builder preview
```

Then view-source on `/dashboard` and `/login`. Every `<Icon>` on both pages is a plain, standalone `<svg>` - the only difference between them is when it was resolved (request time vs. build time), not what it renders.
