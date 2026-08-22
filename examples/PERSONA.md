# Personas and use cases

Who astro-icon is for, what they're each trying to do, and which example app demonstrates it. Each persona below has a runnable app in this directory.

These definitions drive real decisions in the codebase - most visibly the allowlist/unbounded split on Iconify sources, and the build-vs-live collection split, both of which follow from how much a persona actually knows about their icon names ahead of time. Keep them here rather than in the root README, which is npm-facing API documentation.

---

## The site builder

A blog, marketing site, or docs site. Prerendered. 10-30 icons.

Will never read past "Quick start" in the README. If a loader needs configuration beyond a directory of `.svg` files, it's already too much for them.

→ [`site-builder/`](./site-builder)

## The app builder

A dashboard or SaaS product, often SSR or hybrid. A design-system set of icons pulled from an Iconify pack, curated down with an allowlist so the collection - and its generated types - are exactly the set the app actually uses.

Cares about the build/SSR split more than most: the same collection has to resolve identically whether the page that renders it is prerendered or served fresh per request.

→ [`app-builder/`](./app-builder)

## The library author

Ships components containing icons into someone else's app.

Needs icons to work in any consumer's rendering mode with zero setup, and a collection key that can't collide with whatever the consumer names their own icons.

→ [`library-author/`](./library-author)

## The platform builder

Their icon set isn't theirs to decide: names come from a CMS, a database, or whatever a user just typed.

Exercises more of astro-icon's surface than anyone else - live collections, custom `IconSource`s, the bounded-vs-unbounded Iconify split - and faces the decisions the docs explain least.

→ [`platform-builder/`](./platform-builder)

---

## Use cases, ranked

Ordered by how much they matter in practice, not by how interesting they are.

|         | Use case                                                            | Correct behavior                                                                                                         | Where to see it                                             |
| ------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| **UC1** | A handful of local `.svg` files, no options                         | `localSource()` with every default left alone.                                                                           | [site-builder](./site-builder) `src/content.config.ts`      |
| **UC2** | A design-system-sized Iconify pack, curated down                    | An `allowed: [...]` allowlist, so the collection (and its types) are exactly the icons the app uses, not the whole pack. | [app-builder](./app-builder) `mdi` collection               |
| **UC3** | Icon names computed from data, drawn from a small known set         | Still a build-time collection - type the field as `IconName` and each value is checked where the data is defined.        | [platform-builder](./platform-builder) `nav` collection     |
| **UC4** | Icon names from an open-ended catalog (a user's own pick)           | An unbounded Iconify source, plus an `as IconName` cast at the one point a runtime string meets a typed prop.            | [platform-builder](./platform-builder) `catalog` collection |
| **UC5** | Icon names nobody can know before the request (search-as-you-type)  | `<LiveIcon>` against a live collection - a build-time collection can't hold names it can't enumerate.                    | [platform-builder](./platform-builder) `/search`            |
| **UC6** | A library shipping its own icons into a consumer it doesn't control | `localSource(new URL(...))`, anchored to the library's own module, plus a namespaced collection key.                     | [library-author](./library-author)                          |

## Coverage

What each app demonstrates, so a gap is visible rather than assumed.

|                                          | site-builder | app-builder                | library-author          | platform-builder |
| ---------------------------------------- | ------------ | -------------------------- | ----------------------- | ---------------- |
| Rendering mode                           | static       | hybrid (SSR + prerendered) | static                  | SSR only         |
| `localSource()`                          | ✅           | ✅ (brand)                 | ✅ (consumer + library) |                  |
| Iconify pack, bounded (`allowed: [...]`) |              | ✅                         |                         | ✅ (`nav`)       |
| Iconify pack, unbounded                  |              |                            |                         | ✅ (`catalog`)   |
| `<LiveIcon>` / live collections          |              |                            |                         | ✅               |
| Custom `IconSource`                      |              |                            |                         | ✅               |
| Shipping a collection from a library     |              |                            | ✅                      |                  |
| Dynamic icon names + `IconName` typing   |              |                            |                         | ✅               |

### Not covered by any example yet

- **Icons inside framework islands.** No example demonstrates `<Icon>` passed as slotted content into a framework component.
- **`title`/`desc` accessibility**, including the `{ id, value }` form for an element outside the icon referencing its title. Currently only shown in [`demo/`](../demo).
- **Composing several local directories or sources into one collection** (`createIconLoader([localSource("a"), localSource("b")])`, or a local source merged with an Iconify one via `mergeSources`).

## Relationship to `demo/`

[`demo/`](../demo) is a kitchen-sink app that exercises every loader and API surface for manual testing during development. It's deliberately not persona-scoped, and it's the right place to add a quick reproduction. The apps here are the opposite: each is scoped to what one real persona would actually build, so it can be read start to finish.
