---
"astro-icon": patch
---

Widen the `astro` peer dependency from `^5.0.0` to `>=5.0.0`.

Verified against the latest published patch of each currently-available major: Astro 6.4.8 and 7.2.0 (in addition to the already-supported 5.x line). For each version, `tsc` compiled cleanly against Astro's types, the full `<Icon>`/`<Sprite>`/`<LiveIcon>`/content-layer-loader test suite passed against a real `astro build`, and `astro dev` started and served a page without error - ruling out the module-runner crash originally reported in [#277](https://github.com/natemoo-re/astro-icon/issues/277) against an Astro 6 beta.

Two caveats worth knowing, neither of which is an astro-icon regression:
- The `<Sprite>`-outside-prerendering safety check (throws `AstroIconError`) still fires correctly on Astro 7, but Astro's SSR streaming now commits a `200` status before the error surfaces mid-stream, so the response no longer cleanly reports `500` the way it does on Astro 5. The guard itself still works; only the HTTP status code observed by the client differs.
- `@astrojs/node@9.x` (used only in this repo's own SSR test fixtures) doesn't support Astro 6/7 - that's an adapter-side peer dependency gap, not something astro-icon's peer range should account for.
