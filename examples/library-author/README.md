# Library author example

One of four persona examples under `examples/` - see [PERSONA.md](../PERSONA.md) for who each one is and which use cases it covers.

**Who this is:** someone shipping a component library (a design system, a Starlight theme, an internal package) with icons baked into its components, into apps they don't control. Their icons have to work under any consumer's rendering mode with zero setup - a design that requires "add `<SpriteSheet />` to your layout" fails this persona, because they can't touch the consumer's layout.

**Structure:** this is a single Astro app, not two packages - `src/lib/` plays the role of the published library (`acme-ui`) and everything else plays the role of the app that depends on it. In a real split, `src/lib/` would be its own npm package and the rest of this project would `import { acmeUiIcons } from "acme-ui/icons"` instead of `from "./lib/icons"`; nothing else about the pattern changes. See the README's [Shipping icons from a library](../../README.md#shipping-icons-from-a-library) section for the two-package version of this same code.

**What to look at:**

- `src/lib/icons.ts` - the library's collection, keyed `"acme-ui-icons"` (namespaced so it can't collide with a key the consumer picks for their own icons) and built with `localSource(new URL("./icons/", import.meta.url))`, not `localIcons()` - the former resolves against the library's own source file regardless of who imports it; the latter would (incorrectly) resolve against the consumer's project root.
- `src/content.config.ts` - the entire integration surface from the consumer's side: `...acmeUiIcons` spread alongside their own `icons` collection.
- `src/lib/IconButton.astro` - a library component that renders one of the library's own icons. It never places anything in the consumer's layout, and it never assumes sprite optimization is even installed.
- `src/pages/index.astro` - **[UC4](../PERSONA.md#use-cases-ranked)** ("I need to animate/style the icon's internals"). `IconButton`'s `animateIcon` prop forwards to `<Icon inline>` for one specific usage of `spinner.svg`, whose two paths are meant to animate independently - CSS can't pierce a `<use>`'s referenced content, so the *consumer*, not the library, decides per-usage whether that usage needs to stay unsprited.

**Try it:**

```sh
pnpm install
pnpm --filter example-library-author dev
```

Open the page and compare the two spinner buttons: only the one rendered with `inline` actually spins, since `.spinner-head`'s CSS animation can't reach into a sprited icon's shared `<symbol>`. Then try removing `integrations: [icon()]` from `astro.config.mjs` entirely and rebuild - every `<Icon>` in this app, library-authored or not, still renders correctly as a plain inline `<svg>`. Nothing in `src/lib/` changes either way, which is the actual point: the library never knows or cares whether the consumer opted into sprite optimization.
