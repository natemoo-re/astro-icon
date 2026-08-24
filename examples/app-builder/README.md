# App builder example

One of four persona examples under `examples/` - see [PERSONA.md](../PERSONA.md) for who each one is and which use cases it covers.

**Who this is:** a dashboard/SaaS app, mostly SSR, with a design-system icon set drawn from Iconify packs plus a local brand mark.

This app is the official [Flowbite Astro Admin Dashboard](https://github.com/themesberg/flowbite-astro-admin-dashboard) (MIT), trimmed to persona scope (dashboard, users CRUD, sign-in) and ported to current Astro, with every design-system icon migrated from hand-pasted inline `<svg>` to astro-icon. The template's icons are Heroicons copied in by hand; here each one was identified against the `@iconify-json/heroicons*` packs and replaced with `<Icon name="heroicons-solid:...">` etc., preserving each call site's classes and ids.

**What to look at:**

- `astro.config.mjs` - `output: "server"` with the `@astrojs/node` adapter. `/` (dashboard) and `/users` render fresh per request; `/authentication/sign-in` opts into `prerender`. The icon collections resolve identically either way.
- `src/content.config.ts` - **[UC2](../PERSONA.md#use-cases-ranked)**: three Heroicons packs, each curated with an `allowed: [...]` list to exactly the icons the app renders (51 + 5 + 13), so sync and the generated types stay scoped to the real design system instead of thousands of icons. Plus a `brand` collection from `localSource()` for the logo.
- `src/icons/logo.svg` - the Flowbite mark, a full-color SVG with nine internal `<linearGradient>` defs. astro-icon's id-rewriting (`replaceIDs`) is what lets it render three times on one page without gradient-id collisions.
- **What deliberately stayed inline** - country flags in the language picker, payment-network logos, social glyphs in the footer, and illustration artwork. Those aren't design-system icons, so they don't belong in an icon collection; the boundary is the point.
- `src/pages/users.astro` - the CRUD table renders per request with freshly randomized (faker) data; every row repeats the same action icons as plain standalone `<svg>`s.
- `src/modules/DashBoard.client.ts` - untouched upstream chart code (`@ts-nocheck`d), to stay diffable against the template.
- `src/components/FavoriteToggle.tsx` - a hydrated React island (`client:visible`) added to each row of the users table. It never imports `astro-icon`: the star `<Icon>` renders server-side in `src/modules/CrudUsers.astro` and reaches the island only as pre-rendered markup through the default slot (`children`). The island owns the toggle state; astro-icon owns the icon.

**Try it:**

```sh
pnpm install
pnpm --filter example-app-builder build
pnpm --filter example-app-builder preview
```

Avatars and product images load from the upstream template's CDN, so those need network access; everything else - including all icons - is resolved locally at build time.
