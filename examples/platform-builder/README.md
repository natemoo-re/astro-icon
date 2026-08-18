# Platform builder example

One of four persona examples under `examples/` - see [PERSONA.md](../PERSONA.md) for who each one is and which use cases it covers.

**Who this is:** someone whose icon set isn't theirs to decide. The names come from a CMS, a database, or whatever a user just typed into a search box. This persona isn't one of the [original three](../PERSONA.md), because sprites mostly aren't their problem - but they exercise more of astro-icon's surface than anyone else, and the decisions they face are the ones the docs explain least.

The whole app is server-rendered: there's nothing meaningful to prerender when every page depends on data.

**What to look at:**

- `src/pages/index.astro` - **UC5, the easy half.** Names come from data, but the set is curated: the CMS only offers the eight icons in the `nav` collection's `icons: [...]` allowlist. Bounded, so `<Icon>` behaves exactly as it would with a literal name - it resolves at build time, sprites when it repeats, and still type-checks, because the data is typed as `IconName` and each string is checked where the data is defined.
- `src/pages/picker.astro` - **UC5, the hard half.** An end user can pick any of 7,000+ `mdi` icons, so the `catalog` collection has no allowlist. Two consequences, both visible here: it sets `sprite: false` (an unbounded collection on an SSR route would otherwise emit a sprite asset holding the entire pack for every page that touches it), and it needs an `as IconName` cast, because a name assembled at runtime can't satisfy a union of concrete names. A typo becomes a missing icon at request time rather than a build error. That's the real price of an open catalog.
- `src/pages/search.astro` - **where `<Icon>` genuinely can't help.** The names depend on what a visitor typed, so no build-time collection could hold them without enumerating the pack up front. Uses a live collection backed by `iconifyApiSource` with no allowlist: each result is fetched from `api.iconify.design` per request, and only the icons actually shown are ever resolved.
- `src/lib/brandKitSource.ts` + `src/pages/brand.astro` - **a custom `IconSource`**, the plug point for a backend astro-icon doesn't ship. Three methods: `name`, `getIcon`, and an optional `listIcons` - implementing that last one is what lets `/brand` ask the backend what it holds instead of hardcoding names.

**One gotcha this example handles explicitly.** A `LiveLoader` is never told the collection key it was registered under, so typegen records a live collection under its *source's* name. `iconifyApiSource("ph")` names itself `iconify-api:ph`, so registering it as `ph` and writing `<LiveIcon collection="ph">` is a type error against a collection that appears not to exist. Both live collections here rename their source to match their key - see the comments in `src/live.config.ts`.

**Try it:**

```sh
pnpm install
pnpm --filter example-platform-builder dev
```

`/` and `/picker` work offline. `/search` needs network access to `api.iconify.design`; without it, the page renders its error state rather than failing, which is the same way `<LiveIcon>` treats an icon that won't resolve - it logs a warning and renders nothing instead of throwing, so one bad row from a data source can't take down the page around it.
