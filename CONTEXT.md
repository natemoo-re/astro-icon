# Domain glossary

Terms specific to this codebase, for anyone (human or agent) navigating it.

## Content context vs Render context

`packages/core/src/` is split into two directories that mirror this codebase's two bounded contexts:

- **`src/content/`** - turning a backend (a local directory, an Iconify pack, a custom `IconSource`) into Astro content-collection data. Everything about [sources](#icon-source), [packs](#pack), [catalogs](#catalog), and [loaders](#loader-vs-source) lives here, plus sprite state recording and the build-time page rewrite (`content/sprite/`) - both act on already-synced/already-rendered output, not on a single render.
- **`src/render/`** - turning an `IconEntry` already sitting in the content store into markup on a page. `<Icon>`/`<LiveIcon>`'s supporting code (a11y/render props, sprite render-mode decision, name parsing, entry lookup) lives here.

They meet at exactly one point: an `IconEntry`. `src/internal/` holds the one piece genuinely shared by both - `AstroIconError` (see [Resolve vs Build vs Load vs Look up](#resolve-vs-build-vs-load-vs-look-up) for why `renderTimeError`, despite living next to it before, is `render/`-only). `src/index.ts` (the package's `"."` entry), `src/optimize.ts` (transforms an already-built SVG string; independent of both contexts), and `typings/` stay outside both, since they're the whole-package public surface, not a context-specific concern.

## Icon marker

The `data-icon="collection:name"` attribute every `<Icon>`-rendered `<svg>` carries, regardless of context. Originally just a styling hook (`[data-icon="..."]` selectors), it is now also a load-bearing contract: the sprite integration's build-time page rewrite (`content/sprite/rewrite.ts`) scans a finished page's HTML for it to find which icons were rendered where. See `packages/core/components/Icon.astro`.

## Automatic sprite optimization

Repeated `<Icon>` uses are deduped into a `<symbol>`/`<use>` sheet automatically, no wrapper component - the successor to an earlier opt-in `<Sprite>` component (buffered a slot's HTML at render time; only worked on prerendered pages). `sprite: true` (the default on `createIconLoader`) makes a collection eligible; deduping only actually happens once the `icon()` integration (`packages/core/src/integration.ts`) is installed.

`<Icon>` never has enough information at its own render time to know whether _this_ occurrence is one of several on the page - Astro doesn't render template expressions in document order. So it always renders a full inline body on a prerendered page; the integration's `astro:build:generated` hook does the real deduping afterward, as a post-processing pass over each page's finished HTML file (`rewritePageSprites`, `content/sprite/rewrite.ts`) - an icon repeated 2+ times becomes `<use>` against a shared `<symbol>`, injected once into a hidden defs block right after `<body>`. A server-rendered route has no such build pass to run against a live response, so `<Icon>` instead references a shared, hash-versioned asset directly (`/_astro/{collection}.{hash}.svg`) - see [Sprite render mode](#sprite-render-mode).

An icon opts out per-usage via the `inline` prop (`<Icon name="..." inline />`), which skips the sprite-manifest import entirely rather than resolving it and ignoring the result. `<LiveIcon>` output is never eligible at all - it carries its own marker, `data-icon-live` (alongside the [Icon marker](#icon-marker)), which the rewrite skips outright, and it never receives a `renderMode` prop from `IconMarkup` in the first place. Live data isn't guaranteed stable across resolutions the way a static collection entry is, so it's never folded into a shared `<symbol>`.

## Sprite render mode

`resolveSpriteRenderMode` (`packages/core/src/render/spriteMode.ts`)'s decision for one `<Icon>` usage, from static facts only (no sibling state, no render order): `"inline"` (opted out, or the collection isn't sprited), `"prerendered"` (renders inline now; the build rewrite may still dedupe it later), `"asset"` (server-rendered - references the shared asset directly), or `"missing-from-asset"` (a real configuration error - throws rather than silently falling back).

## Sprite state file

`.astro/astro-icon-sprite.json` (`packages/core/src/content/sprite/state.ts`), written by `createIconLoader` after each sync, regardless of whether the `icon()` integration is installed - recording is unconditional; only _reading it back_ (building the runtime manifest, emitting/serving assets) is the integration's job. Each collection's entry carries its sprite preference, a content-addressed hash, and where its rendered asset was staged to disk for the integration to pick up.

## Icon Source

The `IconSource` contract (`packages/core/src/content/source.ts`): `name`, `getIcon(name)`, optional `listIcons()`, `getVersion()`, `concurrency`, `watch(watcher, report)`, `resolveRoot(root)`. The plug point for a backend - a local directory (`localSource`), an Iconify pack (`iconifyLocalSource`/`iconifyApiSource`), or a custom implementation. Distinct from a [Loader](#loader-vs-source) - `IconSource` is astro-icon's own contract, never seen directly by Astro. `watch` and `resolveRoot` are the two hooks a source uses to lean on the generic loader instead of writing its own: `watch` opts into dev-mode file watching (`createIconLoader` turns a reported change into a surgical single-icon update); `resolveRoot` anchors a source that was built eagerly, before Astro's `config.root` existed (`localSource`'s only use of it - see its doc comment for why a plain relative directory string needs this).

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

"Loader" is Astro's own vocabulary - an object satisfying Astro's `Loader`/`LiveLoader` interface (`load`/`loadEntry`/`loadCollection`), and the _only_ thing Astro itself ever sees or names as a collection's `loader:` value. "Source" is astro-icon's own vocabulary - an object satisfying [`IconSource`](#icon-source) (`getIcon`/`listIcons`/`getVersion`). The two are structurally unrelated interfaces, bridged only by astro-icon's `createIconLoader`/`createLiveIconLoader` adapters (`packages/core/src/content/loader.ts`, `liveLoader.ts`).

The relationship is **N sources → 1 loader → 1 collection**, not 1:1 - `mergeSources` (see [Composite source](#composite-source)) can fan multiple sources into a single loader. Each backend contributes only a `source.ts` (implements `IconSource`) under `content/<backend>/` - `content/local/source.ts`, `content/iconify/source.ts` - and is adapted into an Astro `Loader`/`LiveLoader` by the one shared, backend-agnostic pair `content/loader.ts` (`createIconLoader`) and `content/liveLoader.ts` (`createLiveIconLoader`). Local icons used to have their own bespoke `content/local/loader.ts` with duplicated sync/watch logic; it's gone now that `IconSource.watch`/`resolveRoot` let `localSource` opt into the same generic loader everything else uses.

## Composite source

The result of `mergeSources` (`packages/core/src/content/compositeSource.ts`), typed as `CompositeSource`: an ordered list of `IconSource`s tried in turn per icon name, first match wins. `getVersion()` only returns a value if every member reports one; `listIcons()` unions all members. Structurally identical to a plain `IconSource` (the ordered-fallback/aggregation contract is behavioral, not a distinct shape), but now has its own name in code, not just in prose.

## Sync

One run of a [Loader](#loader-vs-source)'s `load()` - a content-layer refresh for one collection. Distinct from, but easily confused with, Astro's own `astro sync` CLI verb (which triggers every collection's `load()`). No dedicated type; purely prose in comments ("the last sync") in `packages/core/src/content/loader.ts`.

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

Resolved structurally, not just by convention: `package.json`'s `exports` map has exactly six entries (`.`, `./components`, `./integration`, `./loaders`, `./loaders/live`, `./optimize`), each pointing at one specific file - never a wildcard into `src/content/`, `src/render/`, or `src/internal/`. Node throws `ERR_PACKAGE_PATH_NOT_EXPORTED` for anything else, so "not listed in `exports`" is an enforced boundary, not a documentation-only one. `./loaders` and `./loaders/live` are barrel files (`src/content/loaders.ts`, `src/content/live.ts`) that only re-export the intentionally public pieces (`iconifyLocalSource`, `iconifyApiSource`, `localSource`, `createIconLoader`, `createLiveIconLoader`, `mergeSources`, `AstroIconError`, `IconSource`, `parseIconSVG`) - everything else under `content/`/`render/`/`internal/` (`buildIcons`, `loadLocalPack`/`loadPackFromAPI`, typegen, sprite state/asset/rewrite, a11y/render props, etc.) is invisible to consumers by never appearing in one of those six entries. `./integration` (`src/integration.ts`) exports only `icon()`, the sprite integration. `./optimize` (`src/optimize.ts`) is its own top-level module, not part of either bounded context - it transforms an already-built SVG string, independent of source/loader/render concerns. **Do not add a wildcard export into `content/`, `render/`, or `internal/`** - that would silently remove this enforcement.
