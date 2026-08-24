# Personas and use cases

Who astro-icon is for and what they're each trying to do. The four personas below are the design tool; each is illustrated by a real, runnable app in this directory, but the persona is the thing being decided, not the app.

These definitions drive real decisions in the codebase - most visibly the allowlist/unbounded split on Iconify sources, and the build-vs-live collection split, both of which follow from how much a persona actually knows about their icon names ahead of time. Keep them here rather than in the root README, which is npm-facing API documentation.

Each app vendors a real, independently-maintained template for its persona, changed only enough to wire in astro-icon and add the use cases that template doesn't already demonstrate. None of these are astro-icon's own design - that's deliberate: a persona's example should look like the kind of app they'd actually reach for, not a shared demo skin repeated four times.

---

## The site builder

A blog, marketing, or portfolio site. Prerendered. 10-30 icons.

Will never read past "Quick start" in the README. If a loader needs configuration beyond a directory of `.svg` files, it's already too much for them. The example is Astro's official Portfolio starter with its hand-rolled icon component swapped for astro-icon - the exact migration this persona would make.

→ [`site-builder/`](./site-builder)

## The app builder

A dashboard or SaaS product, often SSR or hybrid. A design-system set of icons pulled from Iconify packs, curated down with an allowlist so each collection - and its generated types - is exactly the set the app actually uses.

Cares about the build/SSR split more than most: the same collection has to resolve identically whether the page that renders it is prerendered or served fresh per request. The example is the [Flowbite Astro Admin Dashboard](https://github.com/themesberg/flowbite-astro-admin-dashboard), trimmed to persona scope, with every hand-pasted Heroicons `<svg>` matched against `@iconify-json/heroicons*` and replaced with `<Icon>`.

→ [`app-builder/`](./app-builder)

## The library author

Ships components containing icons into someone else's app.

Needs icons to work in any consumer's rendering mode with zero setup, and a collection key that can't collide with whatever the consumer names their own icons. The example is Astro's official Blog starter, whose `Footer.astro` already carries a leftover `astro-icon="social/mastodon"` marker from astro-icon's original sprite-based version - this example finishes what that marker gestures at, with a small `acme-ui`-style library used for real on every post (a copy-link button), not bolted on as a demo.

→ [`library-author/`](./library-author)

## The platform builder

Their icon set isn't theirs to decide: names come from a CMS, a database, or whatever a user just typed.

Exercises more of astro-icon's surface than anyone else - live collections, custom `IconSource`s, the bounded-vs-unbounded Iconify split - and faces the decisions the docs explain least. The example is [AstroWind](https://github.com/onwidget/astrowind), a marketing template whose widgets already take `icon: 'tabler:...'` strings in page data - already this persona's problem, just not yet pushed past what a developer can type into `src/data` ahead of time. Three added routes push past that: a catalog picker, live search, and a custom brand-kit source.

→ [`platform-builder/`](./platform-builder)

---

## Use cases, ranked

Ordered by how much they matter in practice, not by how interesting they are.

|         | Use case                                                            | Correct behavior                                                                                                         | Where to see it                                                                                                                  |
| ------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| **UC1** | A handful of local `.svg` files, no options                         | `localSource()` with every default left alone.                                                                           | [site-builder](./site-builder) `src/content.config.ts`                                                                           |
| **UC2** | A design-system-sized Iconify pack, curated down                    | An `allowed: [...]` allowlist, so the collection (and its types) are exactly the icons the app uses, not the whole pack. | [app-builder](./app-builder) `heroicons-solid`/`heroicons-outline`                                                               |
| **UC3** | Icon names computed from data, drawn from a small known set         | Still a build-time collection - type the field as `IconName` and each value is checked where the data is defined.        | [site-builder](./site-builder) `work` collection's `icon` field (also [platform-builder](./platform-builder) `flat-color-icons`) |
| **UC4** | Icon names from an open-ended catalog (a user's own pick)           | An unbounded Iconify source, plus an `as IconName` cast at the one point a runtime string meets a typed prop.            | [platform-builder](./platform-builder) `tabler` collection, `/picker`                                                            |
| **UC5** | Icon names nobody can know before the request (search-as-you-type)  | `<LiveIcon>` against a live collection - a build-time collection can't hold names it can't enumerate.                    | [platform-builder](./platform-builder) `/search`                                                                                 |
| **UC6** | A library shipping its own icons into a consumer it doesn't control | `localSource(new URL(...))`, anchored to the library's own module, plus a namespaced collection key.                     | [library-author](./library-author)                                                                                               |

## Coverage

What each app demonstrates, so a gap is visible rather than assumed.

|                                                         | site-builder                          | app-builder                    | library-author             | platform-builder               |
| ------------------------------------------------------- | ------------------------------------- | ------------------------------ | -------------------------- | ------------------------------ |
| Vendored template                                       | Astro Portfolio starter               | Flowbite Astro Admin Dashboard | Astro Blog starter         | AstroWind                      |
| Rendering mode                                          | static                                | hybrid (SSR + prerendered)     | static                     | hybrid (static + 3 SSR routes) |
| `localSource()`                                         | ✅                                    | ✅ (brand)                     | ✅ (consumer + library)    |                                |
| Iconify pack, bounded (`allowed: [...]`)                |                                       | ✅ (3 Heroicons packs)         |                            | ✅ (`flat-color-icons`)        |
| Iconify pack, unbounded                                 |                                       |                                |                            | ✅ (`tabler`)                  |
| `<LiveIcon>` / live collections                         |                                       |                                |                            | ✅                             |
| Custom `IconSource`                                     |                                       |                                |                            | ✅                             |
| Shipping a collection from a library                    |                                       |                                | ✅                         |                                |
| Icon names in content frontmatter, build-checked        | ✅ (`work` collection's `icon` field) |                                |                            |                                |
| Dynamic icon names + `IconName` typing                  |                                       |                                |                            | ✅                             |
| Icon passed as slotted content into a framework island  |                                       | ✅ (`FavoriteToggle`)          |                            |                                |
| `title`/`desc` a11y, `{ id, value }` external reference |                                       |                                | ✅ (`Footer` social links) |                                |

### Not covered by any example yet

- **Composing several local directories or sources into one collection** (`createIconLoader([localSource("a"), localSource("b")])`, or a local source merged with an Iconify one via `mergeSources`). No persona's story needs this on its own terms, so it stays a listed gap rather than forced into one.

## Relationship to `demo/`

[`demo/`](../demo) is a kitchen-sink app that exercises every loader and API surface for manual testing during development. It's deliberately not persona-scoped, and it's the right place to add a quick reproduction. The apps here are the opposite: each is scoped to what one real persona would actually build, so it can be read start to finish.
