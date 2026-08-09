# Domain glossary

Terms specific to this codebase, for anyone (human or agent) navigating it.

## Icon marker

The `data-icon="collection:name"` attribute every `<Icon>`-rendered `<svg>` carries, regardless of context. Originally just a styling hook (`[data-icon="..."]` selectors), it is now also a load-bearing contract: `<Sprite>` scans for it to find which icons were rendered in its slot. See `packages/core/components/Icon.astro`.

## Sprite boundary

The subtree wrapped by a single `<Sprite>` component (`packages/core/components/Sprite.astro`). Deduping (repeated icons collapsed into one `<symbol>` + many `<use>`s) is scoped entirely to what's inside this boundary - an `<Icon>` rendered outside any `<Sprite>` is never affected.

## Symbol defs block

The single hidden `<svg style="position:absolute;width:0;height:0" aria-hidden="true">` that a `<Sprite>` emits once, containing one `<symbol>` per unique icon referenced inside its boundary, ahead of the rewritten slot content.

## Request-scoped Sprite marker

`spriteRenderedForRequest`, a `WeakMap<Request, boolean>` (`packages/core/src/core/spriteRequestMarker.ts`) used purely to power a dev-only warning if more than one `<Sprite>` renders on the same page. It carries no icon identity - deliberately simpler than the per-icon dedup cache it replaced (see ADR 0001).

## Icon Inspector

The Astro dev-toolbar app that lets you inspect icon usage on the currently loaded page. Toggling it on highlights every element carrying the [Icon marker](#icon-marker) (`[data-icon]`) and opens a list window of unique icons in use, grouped by `collection:name` with a usage count, with hover/click linking each list row to its on-page highlight(s). Ships via the [`icon()` integration](#icon-integration).

## `icon()` integration

A new, opt-in `AstroIntegration` export whose only responsibility, for now, is calling Astro's `addDevToolbarApp` during `astro:config:setup` to register the [Icon Inspector](#icon-inspector). Not a revival of the pre-content-layer-v2 `integrations: [icon()]` config pattern (still described in `packages/core/README.md` but no longer how icon sources are configured) - this integration carries no icon-source configuration of its own.

## Source link

An optional, best-effort link on each Icon Inspector list row pointing back to an icon's origin: an "open in editor" link (via Astro's `/__open-in-editor` mechanism) for icons from a local source, or an external link to `icon-sets.iconify.design/{collection}/{name}/` for icons from an Iconify source. Icons from any other/custom `IconSource` show no link - there's no generic way to resolve an arbitrary source's origin.
