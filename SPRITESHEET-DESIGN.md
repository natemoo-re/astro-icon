# Spritesheet design

Status: **proposal**, not implemented.

Sprites are automatic, invisible, and have almost no API. The complexity lives in the build, where information is complete and failure is recoverable — never at render time, where neither is true.

Related: [CONTEXT.md](./CONTEXT.md) for domain terms.

---

## Personas

**The site builder.** Blog, marketing site, docs. Prerendered. 10–30 icons. Will never read a page about spritesheets and will never add configuration. If sprites help them, it has to be free and invisible.

**The app builder.** Dashboard or SaaS, often SSR or hybrid. A design-system set of 50–200 icons, heavily repeated — nav, table row actions, buttons. This is who sprites exist for, and notably the persona least served by a prerender-only feature.

**The library author.** Ships components containing icons into someone else's app. Needs icons to work in any consumer's rendering mode with zero setup. Any design requiring "add `<SpriteSheet />` to your layout" is broken for them — they can't touch the consumer's layout.

## Use cases, ranked

1. **Same icon 40× on one page** (a table). Dominant case, biggest win.
2. **Same 20 icons on every page.** Real but secondary — a repeat-navigation optimization.
3. **Three icons on a page.** Sprites are pure overhead. Correct behavior is *do nothing*.
4. **"I need to animate/style the icon's internals."** Must not sprite — CSS can't pierce a `<use>` shadow tree.
5. **Icon names from dynamic data.** Must keep working.

## Principles these imply

- **Zero config for the common case.** Personas 1 and 3 never configure anything.
- **Expose intent, never expose what the build can measure.** Per-page usage, asset bytes, and route rendering mode are all measurable. Navigation patterns and "I need to style internals" are not.
- **No user-placed components.** Fails the library author, ignored by the site builder.
- **Doing nothing is a valid outcome.** UC3 must produce byte-identical output to not spriting.
- **The build optimizes; dev doesn't.** Same as bundling, minification, and CSS extraction — dev/prod divergence is normal here. The requirement isn't byte parity, it's *discoverability*: a sprite-related problem must be findable before deploy.

---

## The API

```ts
// content.config.ts — unchanged. Nothing to add.
icons: defineCollection({ loader: createIconLoader(localIcons()) }),
```

```astro
<Icon name="mdi:home" />          <!-- optimized automatically -->
<Icon name="mdi:home" inline />   <!-- opt out: full body, styleable internals -->
```

```ts
createIconLoader(source, { sprite: false })   // never sprite this collection
```

That's the whole surface. One default you don't write, one per-usage escape hatch, one collection-level override. Everything else is internal.

---

## How it works

### Render time — `<Icon>`

Three branches, every one decided by static facts. No sibling state, no per-request registry, no ordering dependency.

```
entry = resolveIconEntry(collection, name)
cfg   = manifest[collection]        // undefined if not sprited / no integration

props.inline || !cfg
    → <svg {...attrs} data-icon="c:n" data-icon-inline>{body}</svg>

!Astro.isPrerendered
    → if (!cfg.has(id)) throw renderTimeError(...)
      <svg {...attrs} data-icon="c:n"><use href="/_astro/{coll}.{cfg.hash}.svg#{id}"/></svg>

else (prerendered)
    → <svg {...attrs} data-icon="c:n">{body}</svg>
      // unchanged output; the build rewrite transforms it
```

**No dev awareness anywhere in the render path.** SSR routes are byte-identical in dev and prod. Prerendered routes render inline in dev and get optimized by the build — the same way nothing is bundled or minified until you build.

The tradeoff this accepts: CSS that pierces into an icon (`.icon path { … }`) works in dev and breaks after `astro build`, because the icon became a `<use>`. Caught by `astro preview`, CI, or staging — the same place a minification or CSS-extraction problem surfaces. Mitigated by discoverability rather than by distorting the render path: see [Reporting](#reporting).

**No new marker on the happy path.** The rewrite finds icons via the existing `data-icon` attribute — already present, already a documented styling hook — and looks the collection up in the manifest to decide eligibility. Only the *exceptions* are marked: `data-icon-inline` for per-usage opt-outs, and `data-icon-live` (which `<LiveIcon>` already emits) to skip live entries.

Inverting the marker this way means nothing extra is emitted for the common case, so there's no junk to strip when the integration is absent — which is what an HTML-comment marker would have been solving.

**SSR throws on a miss** rather than falling back. If an icon isn't in the asset, that's a configuration error (only reachable once asset subsetting exists) and it should be loud. This inherits the same streaming caveat as every other render-time `<Icon>` throw — on an SSR route the response may already be committed — but it's consistent with the existing "Unable to locate icon" behavior rather than a new failure mode.

### The manifest

A generated **runtime** module (not just `.d.ts`) alongside the existing typegen output in `.astro/astro-icon/`:

```js
export default {
  icons: { hash: "a1b2c3d4", assetIcons: "all" },
  mdi:   { hash: "e5f6a7b8", assetIcons: ["home", "search", …] },
}
```

`<Icon>` already parses the collection from the name, so this is one lookup. **Nothing is added to `entry.data` and the entry schema does not change.**

### Loader (sync)

Unchanged in behavior. It records its `sprite` preference through the existing `recordCollection` channel it already writes to.

### Integration

Owns the manifest, the assets, and the rewrite.

```
config:setup    → register  (verified to run before loaders)
sync/build      → read recorded collections; write manifest module
build           → for each sprited collection: emit /_astro/{coll}.{hash}.svg
build:generated → rewrite emitted HTML
dev             → serve the asset from a dev route (for SSR routes)
```

The hash is **derived independently on both sides** from the same input via a single shared `spriteAssetId(entries)` — no value is passed between loader and integration. They agree because content-addressed hashes of identical input are identical. The failure mode is two serializations drifting, so there must be exactly one function, with a test asserting the emitted file lands at the path `<Icon>` references.

### The rewrite

Build-only. Dev never runs it, which is what keeps streaming and the render path free of dev special-casing.

Parsing uses [ultrahtml](https://github.com/natemoo-re/ultrahtml), already a dependency and already used by `sanitizeSVG.ts`. No new dependency, and no hand-rolled nested-`<svg>` depth counting.

```
per document:
1. skip fast if no data-icon substring
2. collect <svg data-icon> nodes; skip data-icon-inline, data-icon-live,
   and anything inside [data-astro-transition-persist]
3. keep = ids occurring >= 2 times
4. if keep empty                → done, untouched (byte-identical to unsprited)
5. rewrite keep → <use href="#{id}"/>
   inject <svg hidden> defs immediately after <body>   (defs precede uses; no forward reference)
6. anything unexpected → skip the document
```

**Build:** at `astro:build:generated` — after static pages are written, **before adapters bundle or relocate them**. Walk `**/*.html` under `dir` (`getClientOutputDirectory`, guaranteed to exist). This sidesteps pathname→filename mapping entirely: no `build.format`, no `trailingSlash`, no index/404/i18n edge cases. The `pages` array lists routes, it doesn't locate HTML.

Step 6 is the property the old mid-stream rewrite could never have: **un-rewritten output is already correct**, so skipping costs bytes, never correctness.

---

## Heuristics

All internal. None configurable, because each is derived from data the build has and the developer doesn't.

| | Heuristic | Serves |
|---|---|---|
| **H1** | Any collection is spriteable, bounded or not. | UC5, unbounded packs |
| **H2** | Icon used **once** in a document → left inline. `<symbol>`+`<use>` only from 2 occurrences. | **UC3** — "do nothing" is the real default |
| **H3** | Per-page sheet = exactly that page's repeated icons. | UC1, persona 1 |
| **H4** | Emit external asset per collection iff an SSR route may use it. | Persona 2, hybrid |

H2 is what makes UC3 real rather than aspirational: one occurrence gains zero bytes from `<symbol>`+`<use>` and costs ~40, so it never happens.

Prerendered pages never reference the external asset — they always inline their own sheet. Duplication between the two is proportional to actual usage, so it stays small, and it avoids a cold fetch of an entire asset for a page that needs a fraction of it.

## Delivery

**External assets: separate per collection.** Better cache granularity (one collection changing doesn't invalidate the rest), and a page referencing only `icons` never fetches `brand`.

**Inline per-page block: one combined `<svg>`.** It's per-page and non-cacheable regardless, so extra wrappers buy nothing.

Ids are namespaced `ai:{collection}:{name}` in both, so one id function serves both and the inline block — which mixes collections — stays collision-free. The character escaping from `bca443f` applies.

## Degradation

**No integration → no manifest → every icon renders as a plain inline `<svg>`.** Identical to today's output. Everything works; nothing is optimized.

This also makes the worst failure unrepresentable: without manifest gating, SSR `<Icon>` could emit `<use href="/_astro/icons.a1b2.svg#id">` pointing at a file nobody ever wrote — a 404 and invisible icons.

The dependency runs one way: the loader works standalone and produces correct icons; the integration adds optimization.

## Warnings

- **Unbounded collection + SSR.** The severe one. Must state real numbers: *"sprite asset for `mdi` is 2.1MB across 7,483 icons; every SSR page referencing it pays that once."* A generic "consider scoping" will not land.
- **Asset size ceiling**, with actual bytes.
- **Cross-origin `build.assetsPrefix` without CORS.** Silently kills every external reference — icons vanish with no error.

## Reporting

Since the build is the only place optimization happens, it's also the only place it can be observed. This is what makes the dev/prod divergence acceptable rather than a trap.

- **Build summary**: which icons were sprited, on how many pages, bytes saved. Enough to notice that an icon you're styling became a `<use>`.
- **Dev toolbar** ([Icon Inspector](./CONTEXT.md#icon-inspector), already planned): flag icons that *will* be sprited in production, so the information is available while you're writing the CSS rather than after deploying it.

Neither affects the render path. If discoverability turns out to be insufficient in practice, that's an argument for revisiting the tradeoff — not for adding dev-only rendering branches.

---

## Not building (and why)

- **`<SpriteSheet>` component.** Fails the library author, ignored by the site builder. The build controls output; nobody should place anything.
- **`"page"` / `"app"` modes, `minPages`, `minSheetSize`, global mode config.** Knobs for decisions users shouldn't make. `sprite: false` already *is* "inline delivery."
- **Auto-promotion** of cross-page icons into a shared asset. Honest fix for duplication across many prerendered pages, but a heuristic that silently changes output. Wants real numbers from a real site first.
- **Static analysis** of route→icon usage. Needed for asset subsetting; dynamic names make it partial, and mapping route→transitive components isn't something Astro hands you.
- **`sprite.include`** — bounds *the asset* without bounding *the collection*, which `icons: [...]` can't do (it also narrows types and what's loadable). The right fix for the unbounded+SSR warning. Ship when someone hits it. This is what makes the SSR membership throw reachable.
- **`<LiveIcon>` sprite participation.** Possible: hash the live body at render and compare against the asset's recorded hash, emitting `<use>` only on a match. Needs pack identity (`IconSource.name`) and shipping id→hash. Deferred — if live content usually matches the build, it's worth asking why that collection is live.

## Open questions

1. **Integration ordering.** A compression integration placed before ours would compress un-rewritten HTML. Probably docs, not enforcement.
2. **Browser confirmation** of the two interactions analyzed below. The source-level mechanism supports both conclusions, but neither has been run in a browser across React/Vue/Svelte.
3. **The rewrite is never exercised in dev.** Rewrite bugs surface at `astro build`, not while you work. It's a pure function over HTML, so unit tests cover it better than incidental dev usage would — but it does shift where regressions appear.
4. **Is reporting enough?** The dev/prod divergence is only acceptable if a sprited icon is discoverable before deploy. If the build summary and dev toolbar prove insufficient in real use, revisit the tradeoff — don't paper over it with dev-only render branches.

## Verified

Facts this design rests on, with sources, so they don't get re-litigated:

- **`Astro.isPrerendered` is false inside `server:defer` islands.** `render-context.ts:479,744` set it from `routeData.prerender`; `server-islands/endpoint.ts:31` sets `prerender: false`. Server islands take the SSR branch.
- **Integration `config:setup` runs before loaders.** `sync/index.ts:68-75` — `runHookConfigSetup` → `runHookConfigDone` → `syncInternal` → `contentLayer.sync()`.
- **`build:done`/`build:generated` provide `dir`**, the client output directory (`hooks.ts:612`), created before the hook runs. `pages` gives pathnames only, not file paths.
- **`currentColor` works through external `<use>`.** Inherited properties cascade into the shadow tree. What fails is *piercing selectors* (`.icon path {}`) — and those fail same-document too. Cross-origin requires CORS headers or icons silently vanish.
- **ultrahtml is already a dependency** (`packages/core/package.json`), already used in `sanitizeSVG.ts`. Parsing costs nothing new.
- **Client-island slots survive the rewrite.** `astro-island.prebuilt.ts` captures slot content via `querySelectorAll("astro-slot")` → `.innerHTML` and passes those strings to the hydrator. A rewritten `<use href="#id">` is preserved as a string and re-injected into the same document, where the defs block (outside the island) still resolves it.
- **`transition:persist` renders as `data-astro-transition-persist`** (`transitions/router.ts:59`).
- **`entrySchema.ts` uses `.catchall()`** — extra fields would validate, though this design adds none.
- **`is:inline` is not runtime-blocked** (`STATIC_DIRECTIVES` is only `set:html`/`set:text`) but is typed for `<script>`/`<style>` in `elements.ts`. Plain `inline` avoids squatting the reserved namespace.

### The view-transitions interaction

Investigation found a real breakage, and it isn't the one originally predicted.

A persisted element is by definition rendered on both pages, so its icons normally appear in both defs blocks. But **H2 breaks that symmetry**: if an icon appears twice on page A (deduped into A's defs) and once on page B (left inline, so absent from B's defs), then navigating A→B carries a persisted `<use href="#X">` into a document with no `#X`. The icon vanishes.

Fix: **skip rewriting inside `[data-astro-transition-persist]`** — those icons always stay inline, so they're self-contained and survive any swap. Local rule, no cross-page analysis, encoded in step 2 of the rewrite.

---

## Why not the obvious designs

**Registry + separate sheet (v1, `52bb8ff`).** A sheet at a fixed document position can't know about icons rendered after it. `e61559b` added `<Sprite.Provider>` to fix it — by buffering. The demo components in that commit (`await sleep(1000)`/`sleep(2000)`) exist to reproduce the race.

**Buffer and rewrite (v2, `eacf3e4`).** `<Sprite.Provider>`'s buffering with a better API. Unsafe on streamed SSR: `renderToReadableStream` commits headers on the first flushed chunk, so a throw partway down calls `controller.error()` on a response that already sent `200` plus partial HTML — a truncated page, invisible to status-code monitoring.

**First occurrence carries the definition.** Reintroduces every v1 problem, because Astro doesn't render template expressions in document order: in `render-template.ts`, once one expression is async (a `<slot />` always is), the rest are buffered **in parallel** and only flushed sequentially. "First to render" ≠ "first in document."

All three are the same root cause: **the definition's location is a function of render order.** This design removes that by deciding nothing at render time.

**Interim state (implemented):** `<Sprite>` no longer throws on non-prerendered routes; it renders its slot untouched with a dev-only warning. See `.changeset/silly-otters-dance.md`.

---

## Sequencing

1. ~~Manifest module + `<Icon>` three-branch rendering + integration skeleton. Proves the model; no rewrite yet.~~ **Done.**
2. ~~Asset emission + `spriteAssetId` + the path-agreement test. Dev route.~~ **Done.** Verified against a real build (asset on disk, `<Icon>`'s href, and what the server serves at that href all agree) and manually against a real dev daemon.
3. The rewrite (ultrahtml) at `build:generated`. **Next.**
4. Warnings, build summary, dev toolbar reporting.
5. Browser fixture confirming the island-slot and transition-persist conclusions.

## Deleted when this lands

`<Sprite>`, `src/render/sprite/rewrite.ts`, `marker.ts`, the `sprite-ssr` fixture, and the 13 `spriteRewrite` tests. Title/desc stay on the outer `<svg>` where `<Icon>` already puts them — salvaging them out of buffered HTML was the only reason those regexes existed.

CONTEXT.md's **Sprite boundary**, **Symbol defs block**, and **Request-scoped Sprite marker** entries need rewriting. **Icon marker** changes meaning: it stops being a render-time scanning contract and becomes a build-time one.
