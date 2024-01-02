---
"astro-icon": patch
---

**BREAKING**: Requires subdirectory prefixes for local icons.

This fixes a regression introduced in v1 and matches the previous v0 `name` behavior.

As an example, the `src/icons/logos/astro.svg` file could previously be referenced by the name `astro`. It should correctly be referenced as `logos/astro`.

**Before**

```jsx
<Icon name="astro" />
```

**After**

```jsx
<Icon name="logos/astro" />
```
