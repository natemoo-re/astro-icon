---
"astro-icon": patch
---

Fix `viewBox` being inconsistently present on `<svg>` elements across repeated uses of the same icon. The `viewBox` is now always kept on the `<svg>` element, so attributes that depend on it (such as `preserveAspectRatio`) continue to work.
