# astro-icon bench

A manual test bed for `astro-icon`. Each page is a bench: controls on top, live output below, and
the real rendered markup where it's useful. Nothing here is mocked — counts, byte sizes and error
messages all come from the library actually running.

```sh
pnpm --filter demo dev
```

The color swatches in the top bar set `--icon-color` globally, so every icon on every bench
recolors at once. Anything that *doesn't* react isn't using `currentColor`.

| Bench           | What it exercises                                                                  |
| :-------------- | :--------------------------------------------------------------------------------- |
| `/`             | `currentColor` inheritance, attribute vs. CSS sizing                                 |
| `/props/`       | `<Icon>` output per prop combo, with the emitted markup and generated a11y ids       |
| `/collections/` | Every source composition in `content.config.ts`, with real `getCollection()` counts  |
| `/live/`        | `<LiveIcon>` per-request resolution, including the miss path; live search            |
| `/optimize/`    | `svgo()` before/after byte counts, and the `currentColor` warning                    |

`/live/` needs `pnpm --filter service dev` running for its custom-source tab.

## Deliberately broken

`src/icons/lock.svg` is authored with a hardcoded `fill` and no `currentColor`, so `localSource()`
warns about it on every sync. It's the control case for `/optimize/` — don't "fix" it.
