# astro-icon reproduction template

A minimal, pre-configured project for reproducing `astro-icon` issues.

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/fork/github/natemoo-re/astro-icon/tree/main/repro?title=astro-icon%20repro)

## What's included

- `astro` + `astro-icon`, wired up and ready to run
- A local icon in `src/icons/` (rendered as `<Icon name="example" />`)
- The `@iconify-json/mdi` icon set (rendered as `<Icon name="mdi:account" />`)
- Icon collections defined in `src/content.config.ts`

## How to use it

1. Open the template in StackBlitz with the button above (or run it locally with `npm install && npm run dev`).
2. Edit `src/pages/index.astro` (and anything else you need) until the problem reproduces.
3. Save/fork the project in StackBlitz and paste the URL into your bug report.

Please keep the reproduction minimal — remove anything that isn't needed to show the bug.
