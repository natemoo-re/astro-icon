# Library author example

One of four persona examples under `examples/` - see [PERSONA.md](../PERSONA.md) for who each one is and which use cases it covers.

**Who this is:** someone shipping a component library (a design system, a Starlight theme, an internal package) with icons baked into its components, into apps they don't control. Their icons have to work under any consumer's rendering mode with zero setup.

This app is the official [Astro Blog starter](https://github.com/withastro/astro/tree/latest/examples/blog), vendored wholesale like site-builder vendors Portfolio. The starter's own `Footer.astro` already has an `astro-icon="social/mastodon"` attribute on one of its hand-pasted inline `<svg>`s - a leftover marker from astro-icon's very first (sprite-based) version. This example finishes what that marker gestures at: the social icons move to the site's own `icons` collection, and a small `acme-ui`-style library is layered in and used for real, in the actual blog post page, not a demo bolted onto the side.

**Structure:** `src/lib/` plays the role of a published library (`acme-ui`) - it never imports anything from outside itself, and never touches the consumer's `astro.config.mjs` or layout. In a real split, `src/lib/` would be its own npm package and `src/content.config.ts` would `import { acmeUiIcons } from "acme-ui/icons"` instead of `from "./lib/icons"`; nothing else about the pattern changes. See the root README's [Shipping icons from a library](../../README.md#shipping-icons-from-a-library) section for the two-package version of this same code.

**What to look at:**

- `src/lib/icons.ts` - **[UC6](../PERSONA.md#use-cases-ranked)**: the library's collection, keyed `"acme-ui-icons"` (namespaced so it can't collide with a key the consumer picks for their own icons) and built with `localSource(new URL("./icons/", import.meta.url))` - anchored to the library's own source file regardless of who imports it, unlike a plain relative path, which would (incorrectly) resolve against the consumer's project root.
- `src/content.config.ts` - the entire integration surface from the consumer's side: `...acmeUiIcons` spread alongside the site's own `icons` collection ([**UC1**](../PERSONA.md#use-cases-ranked), the same plain `localSource()` as site-builder).
- `src/lib/IconButton.astro` - a library component that renders one of the library's own icons, never a name the consumer supplies. Its scoped styles include a `[hidden]` override, which turned out to be load-bearing: a bare `[hidden]` attribute is normally enough to hide an element, but the component's own `display: inline-flex` class rule otherwise outranks it, so a consumer's `hidden` toggle would silently do nothing without it.
- `src/components/CopyLinkButton.astro` + `src/layouts/BlogPost.astro` - `IconButton` used for real, on every post: a three-state "Copy link" control (idle → copying → copied) built from three `IconButton`s toggled with `hidden`. This is also where `IconButton`'s `.spinner-head` CSS animation earns its place, rather than spinning forever in an isolated demo - it only runs while the clipboard write is actually in flight.
- `src/components/Header.astro` / `Footer.astro` - the starter's three hand-pasted social `<svg>`s, now `<Icon name="mastodon">` etc. against the site's own `icons` collection. Each one carries a `title` in the `{ id, value }` form instead of a separate `sr-only` span, and the wrapping `<a>` references that same id via its own `aria-labelledby` - one accessible name, not two copies of the same string.

**Try it:**

```sh
pnpm install
pnpm --filter example-library-author build
pnpm --filter example-library-author preview
```
