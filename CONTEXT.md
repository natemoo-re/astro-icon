# Domain glossary

Terms specific to this codebase, for anyone (human or agent) navigating it.

## Content context vs Render context

`packages/core/src/` is split into two directories that mirror this codebase's two bounded contexts:

- **`src/content/`** - turning a backend (a local directory, an Iconify pack, a custom `IconSource`) into Astro content-collection data. Everything about [sources](#icon-source), [packs](#pack), [catalogs](#catalog), and [loaders](#loader-vs-source) lives here.
- **`src/render/`** - turning an `IconEntry` already sitting in the content store into markup on a page. `<Icon>`/`<LiveIcon>`/`<Sprite>`'s supporting code (a11y/render props, sprite rewriting, name parsing, entry lookup) lives here.

They meet at exactly one point: an `IconEntry`. `src/internal/` holds the one piece genuinely shared by both - `AstroIconError` (see [Resolve vs Build vs Load vs Look up](#resolve-vs-build-vs-load-vs-look-up) for why `renderTimeError`, despite living next to it before, is `render/`-only). `src/index.ts` (the package's `"."` entry), `src/optimize.ts` (transforms an already-built SVG string; independent of both contexts), and `typings/` stay outside both, since they're the whole-package public surface, not a context-specific concern.

## Icon marker

The `data-icon="collection:name"` attribute every `<Icon>`-rendered `<svg>` carries, regardless of context. Originally just a styling hook (`[data-icon="..."]` selectors), it is now also a load-bearing contract: `<Sprite>` scans for it to find which icons were rendered in its slot. See `packages/core/components/Icon.astro`.

## Sprite boundary

The subtree wrapped by a single `<Sprite>` component (`packages/core/components/Sprite.astro`). Deduping (repeated icons collapsed into one `<symbol>` + many `<use>`s) is scoped entirely to what's inside this boundary - an `<Icon>` rendered outside any `<Sprite>` is never affected.

A `<LiveIcon>` inside the boundary is never deduped, regardless of how many times its `collection:name` repeats - it carries a second marker, `data-icon-live` (alongside the [Icon marker](#icon-marker)), which `Sprite` uses to pass it through untouched instead of resolving/folding it into a shared `<symbol>`. Live data isn't guaranteed stable across resolutions the way a static collection entry is, so `Sprite` doesn't attempt to treat two `<LiveIcon>` occurrences - or a `<LiveIcon>` and a static `<Icon>` that happen to share a `collection:name` - as interchangeable. See `packages/core/src/render/sprite/rewrite.ts`.

## Symbol defs block

The single hidden `<svg style="position:absolute;width:0;height:0" aria-hidden="true">` that a `<Sprite>` emits once, containing one `<symbol>` per unique icon referenced inside its boundary, ahead of the rewritten slot content.

## Request-scoped Sprite marker

`spriteRenderedForRequest`, a `WeakMap<Request, boolean>` (`packages/core/src/render/sprite/marker.ts`) used purely to power a dev-only warning if more than one `<Sprite>` renders on the same page. It carries no icon identity - deliberately simpler than the per-icon dedup cache it replaced.

## Icon Inspector

The Astro dev-toolbar app that lets you inspect icon usage on the currently loaded page. Toggling it on highlights every element carrying the [Icon marker](#icon-marker) (`[data-icon]`) and opens a list window of unique icons in use, grouped by `collection:name` with a usage count, with hover/click linking each list row to its on-page highlight(s). Ships via the [`icon()` integration](#icon-integration).

## `icon()` integration

A new, opt-in `AstroIntegration` export whose only responsibility, for now, is calling Astro's `addDevToolbarApp` during `astro:config:setup` to register the [Icon Inspector](#icon-inspector). Not a revival of the pre-content-layer-v2 `integrations: [icon()]` config pattern (still described in `packages/core/README.md` but no longer how icon sources are configured) - this integration carries no icon-source configuration of its own.

## Source link

An optional, best-effort link on each Icon Inspector list row pointing back to an icon's origin: an "open in editor" link (via Astro's `/__open-in-editor` mechanism) for icons from a local source, or an external link to `icon-sets.iconify.design/{collection}/{name}/` for icons from an Iconify source. Icons from any other/custom `IconSource` show no link - there's no generic way to resolve an arbitrary source's origin.

## Icon Source

The `IconSource` contract (`packages/core/src/content/source.ts`): `name`, `getIcon(name)`, optional `listIcons()`, optional `getVersion()`. The plug point for a backend - a local directory (`localSource`), an Iconify pack (`iconifyLocalSource`/`iconifyApiSource`), or a custom implementation. Distinct from a [Loader](#loader-vs-source) - `IconSource` is astro-icon's own contract, never seen directly by Astro.

## Pack

Iconify's unit of distribution: a named icon set (e.g. `"mdi"`, `"fe"`), represented on the wire/in-memory as `IconifyJSON`. Only meaningful in the Iconify-backed path (`packages/core/src/content/iconify/`) - a local directory of SVGs is never called a pack.

## Catalog

The full, unfiltered list of names a pack (or source) offers, as opposed to whatever subset actually ends up in a [Collection](#collection-vs-pack-vs-catalog-vs-source). Used to type/autocomplete the `icons: [...]` allowlist option. Only formalized in code as typegen's `Packs` kind (`packages/core/src/content/typegen/`); everywhere else ("full, unfiltered catalog") it's prose.

## Collection vs Pack vs Catalog vs Source

Four related but distinct nouns that frequently collide in practice because they often share a literal string by convention:

- **Collection** - Astro's own concept: one `defineCollection({ loader })` entry in `content.config.ts`, keyed by whatever name the consumer picks.
- **Pack** - an Iconify icon set (see [Pack](#pack)).
- **Catalog** - the full name list a pack/source offers (see [Catalog](#catalog)).
- **Source** - astro-icon's `IconSource` (see [Icon Source](#icon-source)), which may back a fraction of a collection, all of it, or be one of several merged into one.

Nothing enforces that a collection's key, its source's `name`, and any underlying pack name line up - `iconifyLocalSource("mdi")` keyed as collection `mdi` is convention, not a rule. The demo's `combined` collection (`createIconLoader([iconifyLocalSource("fe"), iconifyLocalSource("ri")])`) is the concrete case where they don't: one collection, two packs, two sources, no shared name at all. This is a real "gotcha you'll hit the first time you try to merge two packs into one collection," not just terminology pedantry.

## Loader vs Source

"Loader" is Astro's own vocabulary - an object satisfying Astro's `Loader`/`LiveLoader` interface (`load`/`loadEntry`/`loadCollection`), and the *only* thing Astro itself ever sees or names as a collection's `loader:` value. "Source" is astro-icon's own vocabulary - an object satisfying [`IconSource`](#icon-source) (`getIcon`/`listIcons`/`getVersion`). The two are structurally unrelated interfaces, bridged only by astro-icon's `createIconLoader`/`createLiveIconLoader` adapters (`packages/core/src/content/loader.ts`, `liveLoader.ts`).

The relationship is **N sources → 1 loader → 1 collection**, not 1:1 - `mergeSources` (see [Composite source](#composite-source)) can fan multiple sources into a single loader. Every backend follows the same two-file shape under `content/`: a `source.ts` (implements `IconSource`) paired with a `loader.ts` (adapts it into an Astro `Loader`) - see `content/local/{source,loader}.ts` and `content/iconify/{source,loader}.ts`.

## Composite source

The result of `mergeSources` (`packages/core/src/content/compositeSource.ts`), typed as `CompositeSource`: an ordered list of `IconSource`s tried in turn per icon name, first match wins. `getVersion()` only returns a value if every member reports one; `listIcons()` unions all members. Structurally identical to a plain `IconSource` (the ordered-fallback/aggregation contract is behavioral, not a distinct shape), but now has its own name in code, not just in prose.

## Sync

One run of a [Loader](#loader-vs-source)'s `load()` - a content-layer refresh for one collection. Distinct from, but easily confused with, Astro's own `astro sync` CLI verb (which triggers every collection's `load()`). No dedicated type; purely prose in comments ("the last sync") in `packages/core/src/content/loader.ts` and `packages/core/src/content/local/loader.ts`.

## Decorative icon / Labeled icon

The accessibility state every `<Icon>`/`<LiveIcon>` computes (`packages/core/src/render/props.ts`): decorative by default (`aria-hidden`), labeled if given a `title`, `desc`, or explicit `aria-*` prop. A real, consistently-applied domain distinction, described identically in both components' doc comments, though not currently named as such anywhere in code identifiers.

## Resolve vs Build vs Load vs Look up

"Resolve" used to be used for four different operations; now split by what actually happens, and by which context owns it:

- **Build** (`content/`) - source data → a fresh `IconEntry`. `buildIcons` (`packages/core/src/content/buildIcons.ts`, was `resolveAllIcons`) builds many at once from an `IconSource`; `IconSource.getIcon` builds one.
- **Load** (`content/`) - fetch/read a whole Iconify pack's raw `IconifyJSON`, either from a local install or the public API, never both in one call (that composition now lives one layer up, at the `IconSource` level - see [Composite source](#composite-source)). `loadLocalPack`/`loadPackFromAPI` (`packages/core/src/content/iconify/pack.ts`, was `resolveLocalPack`/part of a single `resolvePack`).
- **Resolve** (`render/`, now reserved for exactly this) - read something already materialized. `resolveIconEntry` (`packages/core/src/render/lookupEntry.ts`) looks up an already-synced entry from Astro's content store via `getEntry()`.

`BuiltIcon` (was `ResolvedIcon`) uses `.name` for the bare icon name throughout astro-icon's own (`content/`) layer; it's translated to Astro's `id` vocabulary only at the two points that cross into Astro's own interfaces - `store.set({ id: name, ... })` in `content/loader.ts`, and the `{ id: name, data }` mapping in `content/liveLoader.ts`'s `loadCollection`.

## Cache decisions

Three caches existed; only two survived review, on the principle that a cache is only worth its complexity if it saves real, runtime-visible cost:

- **Dropped**: the old `entryCache` (per-icon, build-side) wrapped Astro's own `getEntry()`, which already reads from an in-memory content store - the cache was paying for a Map, a `${collection}:${name}` key format, and dev/prod branching to save a lookup that was already O(1) in memory. Removed; `resolveIconEntry` (`render/lookupEntry.ts`) now just calls `getEntry()` directly.
- **Kept**: `content/iconify/pack.ts`'s `packCache` - dedupes real I/O (local `@iconify-json/*` file reads) and real network calls (Iconify API fetches) across concurrent `getIcon()` calls for the same pack. Runs at both build-sync time and per-request live time.
- **Kept**: the live loader's own per-icon `cache` in `content/liveLoader.ts` - avoids re-deriving an `IconEntry` (SVG parsing/rendering via `iconToSVG`/`parseIconSVG`) on every request for a repeat icon. Runtime-visible cost, hidden entirely behind the loader's own closure - no separate cache-handling function, no key format exposed to callers.

## Recording a Collection vs a Catalog

`content/typegen/index.ts`'s `recordCollection` now only accepts `kind: "build" | "live"` at the type level - it can no longer be called with `"packs"`. Recording a pack's [catalog](#catalog) goes through a separate `recordCatalog(rootDir, pack, names)`, so "record a collection" and "record a catalog" can't be confused at a call site even though both still funnel through the same private `enqueueWrite` internally. The typegen concern itself is split by role: `typegen/state.ts` (reads/writes the JSON state file) and `typegen/render.ts` (renders `.d.ts` partial text and hashes it for change detection) are the two things `typegen/index.ts` orchestrates.

## Public/internal boundary

Resolved structurally, not just by convention: `package.json`'s `exports` map has exactly five entries (`.`, `./components`, `./loaders`, `./loaders/live`, `./optimize`), each pointing at one specific file - never a wildcard into `src/content/`, `src/render/`, or `src/internal/`. Node throws `ERR_PACKAGE_PATH_NOT_EXPORTED` for anything else, so "not listed in `exports`" is an enforced boundary, not a documentation-only one. `./loaders` and `./loaders/live` are barrel files (`src/content/loaders.ts`, `src/content/live.ts`) that only re-export the intentionally public pieces (`iconifyLocalSource`, `iconifyApiSource`, `localIcons`, `localSource`, `createIconLoader`, `createLiveIconLoader`, `mergeSources`, `AstroIconError`, `IconSource`, `parseIconSVG`) - everything else under `content/`/`render/`/`internal/` (`buildIcons`, `loadLocalPack`/`loadPackFromAPI`, typegen, sprite rewriting, a11y/render props, etc.) is invisible to consumers by never appearing in one of those five entries. `./optimize` (`src/optimize.ts`) is its own top-level module, not part of either bounded context - it transforms an already-built SVG string, independent of source/loader/render concerns. **Do not add a wildcard export into `content/`, `render/`, or `internal/`** - that would silently remove this enforcement.
