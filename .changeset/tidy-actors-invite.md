---
"astro-icon": minor
---

Bump `@iconify/tools` to v5 and `@iconify/utils` to v3, removing the transitive `extract-zip` dependency that was flagged for a symlink path-traversal vulnerability (GHSA-jmr9-qjv8-65gv).

**Requires Node ≥22.12** — `@iconify/utils` v3 uses `node:util`'s `styleText`, which needs Node ≥20.12/21.7, but the toolchain now also builds against Astro 7 (which itself requires Node ≥22.12). Node 20 reached end-of-life in April 2026, so `astro-icon`'s `engines` field is raised to the currently-supported floor rather than the bare minimum.
