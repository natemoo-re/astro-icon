---
"astro-icon": patch
---

Declare `astro` as a peer dependency.

`Icon.astro` imports `HTMLAttributes` from `astro/types`, and the published types import `AstroIntegration` from `astro`, but the package did not declare `astro` as a dependency. When the package is resolved from outside the project tree, as with pnpm or Bun global virtual stores, TypeScript cannot resolve `astro/types`. `class` then disappears from the `Icon` props and every `<Icon class="...">` fails with `Property 'class' does not exist on type 'IntrinsicAttributes & Props'`.
