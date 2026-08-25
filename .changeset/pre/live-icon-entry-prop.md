---
"astro-icon": minor
---

`<LiveIcon>` accepts an `entry` prop as an alternative to `icon`: pass an entry already resolved via `getLiveCollection(collection, { ids })` to render it directly, instead of relying on `<LiveIcon>`'s own cache happening to have been warmed by that earlier batched call.

```astro
---
const { entries } = await getLiveCollection("ph", { ids: results });
---

{entries.map((entry) => <LiveIcon collection="ph" entry={entry} />)}
```

`collection` is still required in both forms - a fetched entry has no collection name of its own to recover it from. Passing both `icon` and `entry` throws, since which one should win would be a guess.
