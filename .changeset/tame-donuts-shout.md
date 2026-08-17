---
"astro-icon": patch
---

Fix `viewBox` being inconsistently present on `<svg>` elements across repeated uses of the same icon. The `viewBox` is now always kept on the `<svg>` element, so attributes that depend on it (such as `preserveAspectRatio`) continue to work. The `<use>` element is anchored to the icon's own `viewBox` rect, which keeps icons with a non-zero `min-x`/`min-y` positioned correctly and stops a per-instance `viewBox` override from leaking onto other instances of the same icon.
