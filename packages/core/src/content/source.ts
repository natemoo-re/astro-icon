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
 * `iconifyLocalSource`/`iconifyApiSource` (Iconify packs) and `localSource` (a directory of `.svg`
 * files) are astro-icon's own implementations; write your own to fetch icons
 * from a design tool, a database, or an internal API.
 *
 * Pass one to {@link createIconLoader} for a build-time collection, or to
 * {@link createLiveIconLoader} for one resolved per request.
 */
export interface IconSource {
  /**
   * Identifies this source in error messages and, for a live collection,
   * generated types. Set it to the same key you register the loader under
   * in `live.config.ts`: a `LiveLoader` is never told its own collection
   * name by Astro, so this is the only identity typegen has to key off of.
   */
  name: string;
  /**
   * Builds one icon by name. Throw (or reject) with a descriptive error if
   * the icon can't be found or built. A loader turns that into `{ error }`
   * for a live collection, or a warning plus a skipped icon for a build one.
   */
  getIcon(name: string): Promise<IconEntry>;
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
   * Caps how many `getIcon` calls `buildIcons` runs concurrently for this source. Omit for no
   * cap (every name resolved at once, the previous and still-default behavior).
   *
   * Meant for a source backed by a shared external resource - a rate-limited API, a
   * connection-limited database - where firing every request at once would be irresponsible
   * regardless of how fast the client itself could go. A source with no such constraint (a local
   * file, an already-cached pack) has no reason to set one: bounding concurrency doesn't make
   * synchronous, already-cached, or otherwise uncontended work resolve any faster.
   */
  concurrency?: number;
  /**
   * Opts this source into dev-mode watching. Called at most once per sync, only when the loader
   * has a real file watcher to hand it (build-time only, not a live collection). Register
   * whatever paths this source depends on with `watcher`, and call `report()` with the affected
   * icon name whenever one of them changes - the loader turns that into a surgical store update
   * (re-running `getIcon` for an "add"/"change", deleting the entry for an "unlink") instead of a
   * full resync.
   *
   * Composing sources that both implement `watch` (e.g. two `localSource()` directories via
   * `mergeSources`/`createIconLoader([...])`) watches all of them - but if two composed sources
   * define the *same* icon name, only the earlier source's file is ever visible in the store,
   * matching `getIcon`'s own first-match-wins order. Editing the shadowed source's file still
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
   * `process.cwd()`-based one, since `LiveLoader`'s own context exposes no project root.
   *
   * Exists because a source is normally built eagerly, in `content.config.ts`, before Astro's
   * `config.root` is available at all - `localSource("src/icons")` implements this so the plain,
   * unanchored string it was given resolves against the project root once the loader can tell it
   * one, instead of silently resolving against `process.cwd()` at each file read (which is only
   * sometimes the project root - `astro build --root <dir>` invoked from elsewhere is a common
   * case where it isn't). A source already anchored to something specific (e.g.
   * `localSource(new URL("../icons/", import.meta.url))`) has no reason to implement this.
   */
  resolveRoot?(root: URL): void;
}
