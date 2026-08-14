---
"astro-icon": patch
---

Fixes `Astro.request.headers` warning on prerendered pages by keying the internal per-render icon cache off `Astro.locals` instead of `Astro.request`
