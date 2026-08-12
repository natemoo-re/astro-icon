---
"astro-icon": patch
---

Fix duplicate/incorrect icons rendering in Chromium-based browsers by rewriting internal SVG ids (e.g. gradients, clip paths) to be unique per rendered icon.
