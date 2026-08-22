# Library author example

One of four persona examples under `examples/` - see [PERSONA.md](../PERSONA.md) for who each one is and which use cases it covers.

**Who this is:** someone shipping a component library (a design system, a Starlight theme, an internal package) with icons baked into its components, into apps they don't control. Their icons have to work under any consumer's rendering mode with zero setup.

**Structure:** this is a single Astro app, not two packages - `src/lib/` plays the role of the published library (`acme-ui`) and everything else plays the role of the app that depends on it. In a real split, `src/lib/` would be its own npm package and the rest of this project would `import { acmeUiIcons } from "acme-ui/icons"` instead of `from "./lib/icons"`; nothing else about the pattern changes. See the README's [Shipping icons from a library](../../README.md#shipping-icons-from-a-library) section for the two-package version of this same code.

**What to look at:**

- `src/lib/icons.ts` - **[UC6](../PERSONA.md#use-cases-ranked)**: the library's collection, keyed `"acme-ui-icons"` (namespaced so it can't collide with a key the consumer picks for their own icons) and built with `localSource(new URL("./icons/", import.meta.url))` - anchored to the library's own source file regardless of who imports it, unlike a plain relative path, which would (incorrectly) resolve against the consumer's project root.
- `src/content.config.ts` - the entire integration surface from the consumer's side: `...acmeUiIcons` spread alongside their own `icons` collection.
- `src/lib/IconButton.astro` - a library component that renders one of the library's own icons. It never places anything in the consumer's layout.
- `src/pages/index.astro` - styling an icon's internals. `IconButton`'s `spinner` icon has two paths meant to animate independently; since `<Icon>` always renders a plain, standalone `<svg>`, `IconButton.astro`'s CSS animation reaches it with nothing to opt into.

**Try it:**

```sh
pnpm install
pnpm --filter example-library-author dev
```
