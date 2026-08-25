# Platform builder example

One of four persona examples under `examples/` - see [PERSONA.md](../PERSONA.md) for who each one is and which use cases it covers.

**Who this is:** someone whose icon set isn't theirs to decide. The names come from a CMS, a database, or whatever a user just typed into a search box. This persona exercises more of astro-icon's surface than anyone else, and the decisions they face are the ones the docs explain least.

This app is [AstroWind](https://github.com/onwidget/astrowind) (MIT), a real marketing-site template whose whole design already leans on astro-icon v1: nearly every widget takes an `icon: 'tabler:...'` string in page data. That's exactly this persona's problem, just not yet pushed to its limit - the template always knows its icon names at build time, because a developer wrote them into `src/data`/`src/navigation.ts`. Four routes were added on top to push past that limit into where names come from a user, a CMS, or a backend instead: `/picker`, `/search`, and `/brand`.

**What changed from the template (and what to look at):**

- `src/content.config.ts` - the 1:1 port of upstream's `astro-icon()` integration config (`icon({ include: { tabler: ['*'], 'flat-color-icons': [...9 names] } })`) into the current collections API. The two packs land on opposite sides of the bounded/unbounded split: `tabler` has no `allowed` list ([**UC4**](../PERSONA.md#use-cases-ranked) - an open catalog, exactly what the template already treats it as), while `flat-color-icons`'s nine names are curated ([**UC3**](../PERSONA.md#use-cases-ranked)).
- Every `<Icon name={...}>` call site that takes a name from a widget's own `string`-typed props (`Button`, `Content`, `FAQs`, `Features`, `Timeline`, ...) now casts `as IconName` - the real cost of the template's own "any tabler icon, as a string, anywhere" design once the type is a union of concrete names instead of `string`.
- `src/live.config.ts` + `src/lib/brandKitSource.ts` - a custom `IconSource` (three methods: `name`, `getIcon`, optional `listIcons`), standing in for a per-tenant brand kit a real platform would call out to. `/brand` renders it live.
- `src/pages/search.astro` - **[UC5](../PERSONA.md#use-cases-ranked), where `<Icon>` genuinely can't help.** Names depend on what a visitor just typed, so this route opts out of prerendering (`export const prerender = false`) and resolves each result through a live `ph` collection backed by `iconifyApi`, fetched per request from `api.iconify.design`.
- `src/pages/picker.astro` - **[UC4](../PERSONA.md#use-cases-ranked)** pushed to a concrete example: per-user saved icon choices from the unbounded `tabler` collection, with the `as IconName` cast that a runtime-assembled name always needs.

**Try it:**

```sh
pnpm install
pnpm --filter example-platform-builder build
pnpm --filter example-platform-builder preview
```

Every page except `/picker`, `/search`, and `/brand` is prerendered, same as upstream AstroWind. `/search` needs network access to `api.iconify.design`; without it, the page renders its error state rather than failing.
