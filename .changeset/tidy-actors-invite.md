---
"astro-icon": minor
---

Bump `@iconify/tools` to v5 and `@iconify/utils` to v3, removing the transitive `extract-zip` dependency that was flagged for a symlink path-traversal vulnerability (GHSA-jmr9-qjv8-65gv).

**Requires Node ≥20.12** — `@iconify/utils` v3 uses `node:util`'s `styleText`, which isn't available on Node 18 (already EOL). `astro-icon`'s `engines` field now reflects this.
