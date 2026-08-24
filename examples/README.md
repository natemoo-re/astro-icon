# Examples

Four small, standalone Astro apps, one per persona. Each is a real `pnpm` workspace package, not a snippet - clone the repo and run any of them with `pnpm --filter <name> dev`.

Start with [PERSONA.md](./PERSONA.md): it defines who each persona is, ranks the use cases they care about, and carries a coverage matrix showing which app demonstrates what (and what nothing demonstrates yet).

- [`site-builder`](./site-builder) - a prerendered blog/marketing site. A handful of local icons, one collection, no options.
- [`app-builder`](./app-builder) - a hybrid app: an SSR dashboard with a curated Iconify pack (`allowed: [...]`), plus a prerendered login page in the same app.
- [`library-author`](./library-author) - a component library shipping its own icons into a consumer app with zero setup.
- [`platform-builder`](./platform-builder) - icon names from a CMS, a database, or a user's search box, via bounded and unbounded Iconify collections, live collections, and a custom `IconSource`.

Unlike [`demo/`](../demo) - a kitchen-sink app exercising every loader and API surface for manual testing during development - each app here is scoped to what one real persona would actually build, so it can be read start to finish.

Each app's `src/styles/global.css` carries the same small set of design tokens (accent color, gray scale, box-shadow), adapted from Astro's official [`blog`](https://github.com/withastro/astro/tree/main/examples/blog) example template - `site-builder`'s layout follows that template's structure directly; the other three reuse its tokens for a consistent look, since Astro doesn't ship an official dashboard/app-shell template to vendor instead.
