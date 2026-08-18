---
"astro-icon": patch
---

Fix `viewBox` being inconsistently present on `<svg>` elements across repeated uses of the same icon. The `viewBox` is now always kept on the `<svg>` element, so attributes that depend on it (such as `preserveAspectRatio`) continue to work. Icons whose `viewBox` has a non-zero `min-x`/`min-y` keep a `viewBox` on their shared `<symbol>` and anchor their `<use>` element, so they stay positioned correctly and a per-instance `viewBox` override no longer leaks onto other instances of the same icon.
