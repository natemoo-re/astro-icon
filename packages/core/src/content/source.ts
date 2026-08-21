import type { IconEntry } from "../../typings/types";

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
   * Anchors this source to the project root, if it needs one. Called once, before any other
   * method, whenever the loader using this source actually has a root to give it -
   * `createIconLoader` always does (`config.root`); `createLiveIconLoader` only has a best-effort
   * `process.cwd()`-based one, since `LiveLoader`'s own context exposes no project root.
   *
   * Exists because a source is normally built eagerly, in `content.config.ts`, before Astro's
   * `config.root` is available at all - a source resolving a relative path (e.g. against a
   * locally installed pack) implements this so it resolves against the project root once the
   * loader can tell it one, instead of silently resolving against `process.cwd()` at each lookup
   * (which is only sometimes the project root - `astro build --root <dir>` invoked from
   * elsewhere is a common case where it isn't). A source already anchored to something specific
   * has no reason to implement this.
   */
  resolveRoot?(root: URL): void;
  /**
   * Checks whether this source is actually usable at all - a missing local install, an
   * unreachable API, a misconfigured credential - as a distinct concern from `listIcons`/
   * `getIcon` themselves. Called once, after `resolveRoot` but before anything else,
   * so a broken source fails clearly and immediately instead of silently surfacing later as a
   * `listIcons`/per-icon `getIcon` failure (in non-strict mode, `getIcon` failures are warned
   * and skipped one icon at a time, which buries a whole-source problem in noise rather than
   * reporting it once, up front).
   *
   * When composed via `mergeSources`, a member's failed `checkPreconditions()` doesn't fail the
   * whole composite by itself - only surfaced if every member that implements `checkPreconditions`
   * fails theirs, matching `getIcon`'s own first-match-wins/no-source-worked contract, since the
   * entire point of composing sources is tolerating one of them being unusable.
   *
   * Omit it if there's nothing meaningful to check before an icon is actually requested (most
   * sources - `iconifyApiSource`, `localSource`).
   */
  checkPreconditions?(): Promise<void>;
}
