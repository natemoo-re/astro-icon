# Examples

Four small, standalone Astro apps, one per persona. Each is a real `pnpm` workspace package, not a snippet - clone the repo and run any of them with `pnpm --filter <name> dev`.

Start with [PERSONA.md](./PERSONA.md): it defines who each persona is, ranks the use cases they care about, and carries a coverage matrix showing which app demonstrates what (and what nothing demonstrates yet).

- [`site-builder`](./site-builder) - a prerendered blog/marketing site. Zero sprite configuration; automatic dedup of repeated nav icons (UC2) alongside the "do nothing" case for once-used content icons (UC3).
- [`app-builder`](./app-builder) - an SSR dashboard. A 40-row table repeating the same action icons (UC1, the dominant case), plus a prerendered page in the same app to show the delivery difference between SSR and prerendered routes.
- [`library-author`](./library-author) - a component library shipping icons into a consumer app with zero setup, plus the per-usage `inline` escape hatch for styling an icon's internals (UC4).
- [`platform-builder`](./platform-builder) - icon names from a CMS, a database, or a user's search box (UC5), via live collections, a custom `IconSource`, and the per-collection `sprite: false` opt-out.

Unlike [`demo/`](../demo) - a kitchen-sink app exercising every loader and API surface for manual testing during development - each app here is scoped to what one real persona would actually build, so it can be read start to finish.
