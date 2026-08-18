# Personas and use cases

Who astro-icon is for, what they're each trying to do, and which example app demonstrates it. Each persona below has a runnable app in this directory.

These definitions drive real decisions in the codebase - most visibly automatic sprite optimization, whose whole design follows from "persona 1 and 3 will never configure anything, and persona 3 can't touch the consumer's layout." Keep them here rather than in the root README, which is npm-facing API documentation.

---

## The site builder

A blog, marketing site, or docs site. Prerendered. 10-30 icons.

Will never read a page about spritesheets and will never add configuration. If an optimization helps them, it has to be free and invisible.

→ [`site-builder/`](./site-builder)

## The app builder

A dashboard or SaaS product, often SSR or hybrid. A design-system set of 50-200 icons, heavily repeated - nav, table row actions, buttons.

This is who sprites exist for, and notably the persona least served by a prerender-only feature.

→ [`app-builder/`](./app-builder)

## The library author

Ships components containing icons into someone else's app.

Needs icons to work in any consumer's rendering mode with zero setup. Any design requiring "add `<SpriteSheet />` to your layout" is broken for them - they can't touch the consumer's layout.

→ [`library-author/`](./library-author)

## The platform builder

Their icon set isn't theirs to decide: names come from a CMS, a database, or whatever a user just typed.

Not part of the sprite design's original three, because sprites mostly aren't their problem. Included here because they exercise more of astro-icon's surface than anyone else - live collections, custom `IconSource`s, the `sprite: false` opt-out - and face the decisions the docs explain least.

→ [`platform-builder/`](./platform-builder)

---

## Use cases, ranked

Ordered by how much they matter in practice, not by how interesting they are.

| | Use case | Correct behavior | Where to see it |
|---|---|---|---|
| **UC1** | Same icon 40× on one page (a table) | Dedupe. Dominant case, biggest win. | [app-builder](./app-builder) `/dashboard` |
| **UC2** | Same 20 icons on every page | Dedupe per page. Real but secondary. | [site-builder](./site-builder) header/footer nav |
| **UC3** | Three icons on a page | **Do nothing.** Sprites are pure overhead; output must be byte-identical to not spriting. | [site-builder](./site-builder) `/blog/hello-world` |
| **UC4** | "I need to animate/style the icon's internals" | Must *not* sprite - CSS can't pierce a `<use>` shadow tree. | [library-author](./library-author) spinner buttons |
| **UC5** | Icon names from dynamic data | Must keep working. | [platform-builder](./platform-builder) all four pages |

## Coverage

What each app demonstrates, so a gap is visible rather than assumed.

| | site-builder | app-builder | library-author | platform-builder |
|---|---|---|---|---|
| Rendering mode | static | hybrid (SSR + prerendered) | static | SSR only |
| `localIcons()` | ✅ | ✅ (brand) | ✅ (consumer) | |
| `localSource()` with a `URL` | | | ✅ | |
| Iconify pack, bounded (`icons: [...]`) | | ✅ | | ✅ (`nav`) |
| Iconify pack, unbounded | | | | ✅ (`catalog`) |
| Sprite: automatic dedupe | ✅ | ✅ | ✅ | ✅ |
| Sprite: external asset (SSR) | | ✅ | | ✅ |
| Sprite: per-usage `inline` opt-out | | | ✅ | |
| Sprite: per-collection `sprite: false` | | | | ✅ |
| `<LiveIcon>` / live collections | | | | ✅ |
| Custom `IconSource` | | | | ✅ |
| Shipping a collection from a library | | | ✅ | |
| Dynamic icon names + `IconName` typing | | | | ✅ |

### Not covered by any example yet

- **Icons inside framework islands.** Slot content surviving the sprite rewrite is verified in a real browser (`packages/core/test/browser/sprite.spec.ts`), but no example demonstrates it.
- **`transition:persist` with view transitions.** The rewrite deliberately skips persisted regions to avoid a broken cross-page reference; [site-builder](./site-builder) is multi-page and would be its natural home.
- **`optimize` / SVGO.** No example passes an `optimize` function.
- **`title`/`desc` accessibility**, including the `{ id, value }` form for an element outside the icon referencing its title. Currently only shown in [`demo/`](../demo).

## Relationship to `demo/`

[`demo/`](../demo) is a kitchen-sink app that exercises every loader and API surface for manual testing during development. It's deliberately not persona-scoped, and it's the right place to add a quick reproduction. The apps here are the opposite: each is scoped to what one real persona would actually build, so it can be read start to finish.
