import type { LiveLoader } from "astro/loaders";
import { AstroIconError } from "../internal/error.js";
import { buildIcon, buildIcons } from "./buildIcons.js";
import { formatDuration } from "./duration.js";
import { consoleLogger } from "./logger.js";
import { mergeSources } from "./compositeSource.js";
import { recordCollection } from "./typegen/index.js";
import type { IconSource } from "./source.js";
import type { IconEntry } from "../../typings/types";

/**
 * Wraps a source so repeat `getIcon` calls for the same name are served from memory for the
 * process lifetime, keeping the source's full shape - `concurrency`, `listIcons`, and the rest
 * pass through untouched, so downstream consumers like `buildIcons` see a real `IconSource`.
 * Caches what the source built, pre-sanitize: sanitizing stays `buildIcon`'s job alone, and a
 * cache below it can't become a second path around that choke point.
 */
function cachingSource(source: IconSource): IconSource {
  const cache = new Map<string, IconEntry>();
  return {
    ...source,
    async getIcon(name) {
      const cached = cache.get(name);
      if (cached) return cached;
      const entry = await source.getIcon(name);
      cache.set(name, entry);
      return entry;
    },
  };
}

export interface LiveIconLoaderOptions {
  /**
   * The key this loader is registered under in `live.config.ts`'s `collections` object, used
   * as the generated `LiveCollectionName` type. Prefer `liveIconCollections()`, which supplies
   * it from its own object keys so the two can't drift; declare it here only when calling
   * Astro's `defineLiveCollection()` yourself. Astro only reveals the real key at request time,
   * so a mismatch is warned about (and typegen corrected) on the collection's first request.
   */
  collection: string;
}

/**
 * Builds a live content collection loader (`defineLiveCollection()`) around
 * one or more {@link IconSource}s, resolving icons on demand per request
 * instead of at build time. Use this when you can't know your icon names
 * ahead of time, such as a user-driven icon search.
 *
 * Prefer `liveIconCollections()`, which calls this and never repeats the
 * collection key; use this directly when you need Astro's raw registration
 * form:
 *
 * ```ts
 * // src/live.config.ts
 * import { defineLiveCollection } from "astro:content";
 * import { createLiveIconLoader, iconifyLocalSource } from "astro-icon/loaders/live";
 *
 * export const collections = {
 *   mdi: defineLiveCollection({
 *     loader: createLiveIconLoader(iconifyLocalSource("mdi", { allowed: ["home"] }), {
 *       collection: "mdi",
 *     }),
 *   }),
 * };
 * ```
 *
 * Caches resolved entries for the lifetime of the server process, wraps
 * thrown errors as `{ error }` for `getLiveEntry()`/`getLiveCollection()`,
 * and, when the source supports `listIcons()`, fulfills whole-collection
 * loads and generates autocomplete types for it.
 */
export function createLiveIconLoader(
  sources: IconSource | IconSource[],
  options: LiveIconLoaderOptions,
): LiveLoader<IconEntry, { id: string }, never> {
  // Cached at the source seam (not per load function) so `loadEntry` and `loadCollection`
  // share one cache, and everything downstream handles a plain `IconSource`.
  const source = cachingSource(mergeSources(sources));
  const { collection } = options;

  // Best-effort typegen at construction time, since `LiveLoader`'s context exposes no project
  // root, and reveals the real collection key only per request - hence the declared `collection`
  // option, verified against the real key on first request (see `verifyCollectionKey`).
  // `LiveCollectionName` only needs the collection key to exist: a live collection's specific icons resolve per
  // request and are never validated against a catalog (see names.d.ts), so this records an empty list rather than
  // resolving the source's full catalog just to discard it. `listIcons()` is still called for its side effect:
  // sources like `iconifyLocalSource` use it to record their own full pack catalog for typing the `allowed: [...]` option.
  const rootDir = new URL(`file://${process.cwd()}/`);
  // Best-effort only: `process.cwd()` isn't necessarily the project root (see
  // `IconSource.resolveRoot`'s doc comment), but it's the only thing a live collection has.
  source.resolveRoot?.(rootDir);
  // Same "fail loudly, up front" intent as `createIconLoader`'s own `checkPreconditions()` call,
  // just downgraded to a warning: a `LiveLoader` has no "build
  // failed" concept to hook into - `loadEntry`/`loadCollection` already turn a broken source into
  // `{ error }` per request regardless - so this only gets a source's problem into the logs
  // immediately instead of waiting for the first request to surface it.
  source.checkPreconditions?.().catch((ex) => {
    consoleLogger.warn(
      `"${source.name}" isn't usable: ${ex instanceof Error ? ex.message : ex}`,
    );
  });
  if (source.listIcons) source.listIcons().catch(() => {});
  recordCollection(rootDir, "live", collection, []).catch(() => {});

  // Astro tells a live loader its real collection key per request, and only there. Checked once:
  // a `collection` option that doesn't match the registered key means the construction-time
  // typegen above recorded a nonexistent `LiveCollectionName`, so re-record under the real key
  // and say so, instead of leaving type errors on correct call sites.
  let checkedCollectionKey = false;
  function verifyCollectionKey(actual: string | undefined): void {
    if (checkedCollectionKey || !actual) return;
    checkedCollectionKey = true;
    if (actual === collection) return;
    consoleLogger.warn(
      `This live icon loader is registered as the "${actual}" collection, but was created with \`collection: "${collection}"\` - generated LiveCollectionName types used the wrong key. Update the \`collection\` option (or build this collection with \`liveIconCollections()\`) so they match.`,
    );
    recordCollection(rootDir, "live", actual, []).catch(() => {});
  }

  return {
    name: `astro-icon/loaders/live/${source.name}`,
    loadEntry: async ({ filter, collection: actual }) => {
      verifyCollectionKey(actual);
      try {
        // Through `buildIcon`, not `source.getIcon` directly, so this per-request path gets the
        // same sanitize choke point as everything else - a custom `IconSource` backing this live
        // loader (the lowest-trust case, its content never validated by this library) can't
        // bypass it by building its `IconEntry` some other way.
        const { data } = await buildIcon(source, filter.id);
        return { id: filter.id, data };
      } catch (ex) {
        return { error: ex instanceof Error ? ex : new Error(String(ex)) };
      }
    },
    loadCollection: async (context) => {
      verifyCollectionKey(context?.collection);
      if (!source.listIcons) {
        return {
          error: new AstroIconError(
            `"${source.name}" doesn't support loading an entire live icon collection.`,
            `Request icons individually via \`getLiveEntry(collection, name)\` instead of \`getLiveCollection(collection)\`.`,
          ),
        };
      }
      const loadStart = performance.now();
      try {
        const names = await source.listIcons();
        const built = await buildIcons(source, names, (name, ex) => {
          consoleLogger.warn(
            `"${source.name}" failed to load "${name}" while listing its collection: ${ex instanceof Error ? ex.message : ex}`,
          );
        });
        // Debug-only, matching `createIconLoader`'s own build-duration log - `LiveLoader`'s
        // context has no Astro logger, so this falls back to `consoleLogger` the same way the
        // warning above does.
        consoleLogger.debug(
          `Loaded ${built.length} icon(s) for "${source.name}"'s live collection in ${formatDuration(performance.now() - loadStart)}.`,
        );
        // `name` -> `id` only here, where astro-icon's own vocabulary crosses into `LiveLoader`'s.
        return { entries: built.map(({ name, data }) => ({ id: name, data })) };
      } catch (ex) {
        return { error: ex instanceof Error ? ex : new Error(String(ex)) };
      }
    },
  };
}
