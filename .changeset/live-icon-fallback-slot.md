---
"astro-icon": minor
---

`<LiveIcon>` renders a `fallback` slot when its icon fails to resolve, instead of always rendering nothing:

```astro
<LiveIcon collection="ph" icon={query}>
  <PlaceholderIcon slot="fallback" />
</LiveIcon>
```

A miss is expected request data (a typo, an unreachable API), not a bug, so the caller decides what it looks like instead of `<LiveIcon>` guessing. The console warning is unchanged; omitting the slot still renders nothing, same as before.
