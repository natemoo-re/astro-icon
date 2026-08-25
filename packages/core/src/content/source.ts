import type { IconEntry } from "../../typings/types";

/**
 * The subset of Astro's/chokidar's shared dev-server watcher an {@link IconSource} needs to
 * register itself: enough to add paths and listen for its own "error" event, nothing else.
 */
export interface IconSourceWatcher {
  on(event: string, listener: (...args: any[]) => void): void;
  add(paths: string | readonly string[]): void;
}

/** One file-level change a watching {@link IconSource} reports back to its loader. */
export type IconChangeEvent =
  { type: "add" | "change"; name: string } | { type: "unlink"; name: string };

/**
 * The interface for plugging a custom icon backend into astro-icon.
 * `iconify`/`iconifyApi` (Iconify packs) and `localIcons` (a directory of `.svg`
 * files) are astro-icon's own implementations; write your own to fetch icons
 * from a design tool, a database, or an internal API.
 *
 * Pass one to `defineIconCollection` for a build-time collection, or to
 * `defineLiveIconCollections` for one resolved per request (or to their
 * loader-layer equivalents, {@link createIconLoader}/{@link createLiveIconLoader}).
 */
export interface IconSource {
  /**
   * Identifies this source in error and log messages, e.g. `iconify:mdi`.
   * A diagnostic label only - nothing keys off it; a live collection's typegen
   * key comes from `createLiveIconLoader`'s own `collection` option.
   */
  name: string;
  /**
   * Builds many icons by name in one call - the only way an `IconSource`
   * fetches, whether a caller wants one icon or a thousand. Return a map
   * covering every name in `names`: a resolved `IconEntry` for one that
   * built, or an `Error` for one that didn't - so one bad name (a typo, an
   * icon the pack doesn't have) can't take the rest of the batch down with
   * it. `buildIcons` turns a per-name `Error` into `{ error }` for a live
   * collection, or a warning plus a skipped icon for a build one.
   *
   * Rejecting the whole call is also fine, and treated as every name in
   * `names` failing for that same reason - reach for that when the failure
   * genuinely isn't per-name (the network is down, a pack failed to load at
   * all), rather than manually stamping the same `Error` onto every key.
   *
   * Implement this as a real batch wherever the backing resource supports
   * one (`iconifyApi` requests every name in `names` in a single
   * `?icons=a,b,c` call); a source with nothing to batch (`localIcons`,
   * already-in-memory Iconify packs) can simply resolve each name from
   * `names` independently - the caller neither knows nor cares which.
   */
  getIcons(names: string[]): Promise<Map<string, IconEntry | Error>>;
  /**
   * Lists every icon name this source can build. Required for a build
   * collection: `createIconLoader` loads exactly this list. Optional for a
   * live one, where it additionally enables `getLiveCollection()` and full
   * autocomplete instead of a plain `string` type.
   */
  listIcons?(): Promise<string[]>;
  /**
   * Reports a cheap freshness signal for this source, such as an installed
   * pack's npm version. If every source in a collection reports one and it
   * matches the last sync, `createIconLoader` skips re-building anything.
   * Omit it if there's no reliable way to tell "nothing changed" short of
   * building; the loader always falls back to a full build.
   */
  getVersion?(): Promise<string | undefined>;
  /**
   * Opts this source into dev-mode watching. Called at most once per sync, only when the loader
   * has a real file watcher to hand it (build-time only, not a live collection). Register
   * whatever paths this source depends on with `watcher`, and call `report()` with the affected
   * icon name whenever one of them changes - the loader turns that into a surgical store update
   * (re-running `getIcons` for an "add"/"change", deleting the entry for an "unlink") instead of a
   * full resync.
   *
   * Composing sources that both implement `watch` (e.g. two `localIcons()` directories via
   * `mergeSources`/`createIconLoader([...])`) watches all of them - but if two composed sources
   * define the *same* icon name, only the earlier source's file is ever visible in the store,
   * matching `getIcons`'s own first-match-wins order. Editing the shadowed source's file still
   * triggers a resync (via `report()`), it just re-resolves to the same, unchanged winner - so
   * keep icon names disjoint across composed sources you intend to watch, or the shadowed file's
   * edits will appear to do nothing.
   */
  watch?(
    watcher: IconSourceWatcher,
    report: (event: IconChangeEvent) => void,
  ): void;
  /**
   * Anchors this source to the project root, if it needs one. Called once, before any other
   * method, whenever the loader using this source actually has a root to give it -
   * `createIconLoader` always does (`config.root`); `createLiveIconLoader` only has a best-effort
   * one (`guessProjectRoot()`, see `src/content/projectRoot.ts`), since `LiveLoader`'s own
   * context exposes no project root.
   *
   * Exists because a source is normally built eagerly, in `content.config.ts`, before Astro's
   * `config.root` is available at all - `localIcons("src/icons")` implements this so the plain,
   * unanchored string it was given resolves against the project root once the loader can tell it
   * one, instead of silently resolving against a best-effort guess at each file read (which is
   * only sometimes the project root - `astro build --root <dir>` invoked from elsewhere is a
   * common case where it isn't). A source already anchored to something specific (e.g.
   * `localIcons(new URL("../icons/", import.meta.url))`) has no reason to implement this.
   */
  resolveRoot?(root: URL): void;
  /**
   * Checks whether this source is actually usable at all - a missing local install, an
   * unreachable API, a misconfigured credential - as a distinct concern from `listIcons`/
   * `getIcons` themselves. Called once, after `resolveRoot` but before anything else,
   * so a broken source fails clearly and immediately instead of silently surfacing later as a
   * `listIcons`/`getIcons` failure (in dev, a name `getIcons` reports as an `Error` is warned and
   * skipped, one at a time, which buries a whole-source problem in noise rather than reporting it
   * once, up front).
   *
   * When composed via `mergeSources`, every member's `checkPreconditions()` runs, but a single
   * member failing doesn't fail the whole composite by itself: it's warned about and the
   * composite stays usable, matching `getIcons`'s own first-match-wins/no-source-worked contract,
   * since the entire point of composing sources is tolerating one of them being unusable. Only
   * when no member is usable at all does the composite's `checkPreconditions()` throw.
   *
   * Omit it if there's nothing meaningful to check before an icon is actually requested (most
   * sources - `iconifyApi`, `localIcons`).
   */
  checkPreconditions?(): Promise<void>;
}
