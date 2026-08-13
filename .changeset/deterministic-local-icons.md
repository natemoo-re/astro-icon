---
"astro-icon": patch
---

Strip the `lastModified` timestamp from the generated local icon collection so its output is deterministic across builds, allowing Astro's incremental build cache to work as expected.
