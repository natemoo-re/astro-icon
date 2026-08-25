# astro-icon bench

A manual test bed for `astro-icon`. Each page is a bench: controls on top, live output below, and
the real rendered markup where it's useful. Nothing here is mocked — counts, byte sizes and error
messages all come from the library actually running.

```sh
pnpm --filter demo dev
```

The color swatches in the top bar set `--icon-color` globally, so every icon on every bench
recolors at once. Anything that _doesn't_ react isn't using `currentColor`.

| Bench           | What it exercises                                                                                                     |
| :-------------- | :-------------------------------------------------------------------------------------------------------------------- |
| `/`             | `currentColor` inheritance, attribute vs. CSS sizing, the `data-icon` styling hook                                    |
| `/patterns/`    | Icons inside real components: buttons, a working toolbar, fields, alerts — all `em`-sized and color-inherited         |
| `/props/`       | `<Icon>` output per prop combo, entry-default `<title>`/`<desc>`, the a11y conflict warnings                          |
| `/collections/` | Every source composition in `content.config.ts` (incl. API-only and nested names), with real `getCollection()` counts |
| `/live/`        | `<LiveIcon>` per-request resolution, including the miss path; live search                                             |
| `/optimize/`    | `svgo()` before/after byte counts, and the `currentColor` warning                                                     |
| `/playground/`  | Paste/import any SVG and run the real `svgo()` → `entryFromSVG()` pipeline with live knobs                            |

`/live/` needs `pnpm --filter service dev` running for its custom-source tab.

## Deliberately broken

`src/icons/lock.svg` is authored with a hardcoded `fill` and no `currentColor`, so `localSvg()`
warns about it on every sync. It's the control case for `/optimize/` — don't "fix" it.
`src/icons/logo.svg` trips the same warning because its gradient fill isn't `currentColor` —
that's the point of a brand mark, so leave it too.

Likewise `/props/`'s "title + aria-label" case renders a deliberately conflicting combination so
the dev-mode console warning has somewhere to fire, and `src/icons/badge.svg` keeps its inline
`<title>`/`<desc>` on purpose — it's the entry-default a11y case.

The `apiOnly` collection fetches from `api.iconify.design` at sync time, so the first sync needs
network; after that it's cached until the collection config changes.
