---
"astro-icon": patch
---

fix: resolve the local icon watcher directory with `fileURLToPath` instead of `URL.pathname`

`config.root` is a file URL, and `URL.pathname` yields `/C:/...` on Windows. Passing that
to `path.resolve()` makes it use the current working directory's drive instead of the URL's
drive, so the icon directory was never watched correctly and dev mode could get stuck reloading with
`transport was disconnected, cannot call "fetchModule"`.

Also hoists the resolved directory out of the `watcher.on("all")` callback, so it is
computed once instead of on every watcher event.

The watcher now also checks directory boundaries correctly, so sibling directories such as
`src/icons-2/` do not trigger unnecessary reloads.
