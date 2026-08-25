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
 * Wraps a source so repeat `getIcons` calls for the same name are served from memory for the
 * process lifetime, keeping the source's full shape - `listIcons` and the rest pass through
 * untouched, so downstream consumers like `buildIcons` see a real `IconSource`. Caches what the
 * source built, pre-sanitize: sanitizing stays `buildIcons`'s job alone, and a cache below it
 * can't become a second path around that choke point.
 *
 * Only ever asks the underlying source for names that aren't cached yet - a `getIcons(names)`
 * call with every name already cached never reaches `source` at all, and one with a mix of
 * cached and uncached names fetches only the uncached ones, still in a single call. This is also
 * what makes a batched `loadCollection({ filter: { ids } })` request (below) warm the cache for
 * every id it resolves, so a later single `getLiveEntry`/`<LiveIcon>` lookup for one of those
 * same ids is a cache hit instead of a fresh fetch.
 */
function cachingSource(source: IconSource): IconSource {
  const cache = new Map<string, IconEntry>();
  return {
    ...source,
    async getIcons(names) {
      const result = new Map<string, IconEntry | Error>();
      const missing: string[] = [];
      for (const name of names) {
        const cached = cache.get(name);
        if (cached) result.set(name, cached);
        else missing.push(name);
      }
      if (missing.length > 0) {
        const fetched = await source.getIcons(missing);
        for (const [name, entry] of fetched) {
          result.set(name, entry);
          if (!(entry instanceof Error)) cache.set(name, entry);
        }
      }
      return result;
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
 * import { createLiveIconLoader, iconify } from "astro-icon/collections";
 *
 * export const collections = {
 *   mdi: defineLiveCollection({
 *     loader: createLiveIconLoader(iconify("mdi", { allowed: ["home"] }), {
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
 *
 * `getLiveCollection(collection, { ids: [...] })` resolves exactly that
 * subset in one batched call instead - the shape a search-as-you-type page
 * wants: every result name is already known before any of them are fetched,
 * so there's no reason to resolve them one `<LiveIcon>` at a time. See
 * `loadCollection` below.
 */
export function createLiveIconLoader(
  sources: IconSource | IconSource[],
  options: LiveIconLoaderOptions,
): LiveLoader<IconEntry, { id: string }, { ids: string[] }> {
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
  // sources like `iconify` use it to record their own full pack catalog for typing the `allowed: [...]` option.
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
    name: `astro-icon/collections/${source.name}`,
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
      const ids = context?.filter?.ids;

      // The batched, specific-subset path: every id in `filter.ids` in one `buildIcons` call -
      // which, for a source with a real batching backend (`iconifyApi`), is one HTTP
      // request no matter how many ids that is. Doesn't need `listIcons()` at all: unlike the
      // whole-collection path below, the caller already knows exactly which names it wants.
      if (ids) {
        const loadStart = performance.now();
        const built = await buildIcons(source, ids, (name, ex) => {
          consoleLogger.warn(
            `"${source.name}" failed to load "${name}" for a batched live collection request: ${ex instanceof Error ? ex.message : ex}`,
          );
        });
        consoleLogger.debug(
          `Loaded ${built.length}/${ids.length} requested icon(s) for "${source.name}"'s live collection in ${formatDuration(performance.now() - loadStart)}.`,
        );
        return { entries: built.map(({ name, data }) => ({ id: name, data })) };
      }

      if (!source.listIcons) {
        return {
          error: new AstroIconError(
            `"${source.name}" doesn't support loading an entire live icon collection.`,
            `Request icons individually via \`getLiveEntry(collection, name)\`, pass \`{ ids: [...] }\` to \`getLiveCollection(collection, filter)\` for a specific subset, or use \`iconify\`/\`localSvg\` (which both support \`listIcons()\`) instead of \`getLiveCollection(collection)\` with no filter at all.`,
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
