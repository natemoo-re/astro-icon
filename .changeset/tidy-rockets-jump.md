---
"astro-icon": minor
---

`title`/`desc` props now accept `{ id, value }` in addition to a plain string, so consumers can set `id` attributes on the generated `<title>`/`<desc>` elements for `aria-labelledby` referencing.
