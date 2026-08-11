import type { LiveLoader } from "astro/loaders";
import { AstroIconError } from "../core/AstroIconError.js";
import { consoleLogger } from "../core/logger.js";
import { mergeSources } from "../core/mergeSources.js";
import { resolveAllIcons } from "../core/resolveAllIcons.js";
import { recordCollection } from "../typegen.js";
import type { IconSource } from "../core/iconSource.js";
import type { IconEntry } from "../../typings/types";

/**
 * Builds a live content collection loader (`defineLiveCollection()`) around
 * one or more {@link IconSource}s, resolving icons on demand per request
 * instead of at build time. Use this when you can't know your icon names
 * ahead of time, such as a user-driven icon search.
 *
 * ```ts
 * // src/live.config.ts
 * import { defineLiveCollection } from "astro:content";
 * import { createLiveIconLoader, iconifySource } from "astro-icon/loaders/live";
 *
 * export const collections = {
 *   mdi: defineLiveCollection({ loader: createLiveIconLoader(iconifySource("mdi")) }),
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
): LiveLoader<IconEntry, { id: string }, never> {
  const source = mergeSources(sources);
  const cache = new Map<string, IconEntry>();

  // Best-effort typegen at construction time, since `LiveLoader`'s context exposes no project root or collection name.
  // `LiveCollectionName` only needs the collection key to exist (a live collection's specific icons resolve
  // per-request and are never validated against a catalog - see names.d.ts), so this records an empty list rather
  // than resolving the source's full catalog just to discard it. `listIcons()` is still called for its side effect:
  // sources like `iconifySource` use it to record their own full pack catalog for typing the `icons: [...]` option.
  const rootDir = new URL(`file://${process.cwd()}/`);
  if (source.listIcons) source.listIcons().catch(() => {});
  recordCollection(rootDir, "live", source.name, []).catch(() => {});

  async function getCachedIcon(name: string): Promise<IconEntry> {
    const cached = cache.get(name);
    if (cached) return cached;
    const entry = await source.getIcon(name);
    cache.set(name, entry);
    return entry;
  }

  return {
    name: `astro-icon/loaders/live/${source.name}`,
    loadEntry: async ({ filter }) => {
      try {
        const entry = await getCachedIcon(filter.id);
        return { id: filter.id, data: entry };
      } catch (ex) {
        return { error: ex instanceof Error ? ex : new Error(String(ex)) };
      }
    },
    loadCollection: async () => {
      if (!source.listIcons) {
        return {
          error: new AstroIconError(
            `"${source.name}" doesn't support loading an entire live icon collection.`,
            `Request icons individually via \`getLiveEntry(collection, name)\` instead of \`getLiveCollection(collection)\`.`,
          ),
        };
      }
      try {
        const names = await source.listIcons();
        const entries = await resolveAllIcons({ getIcon: getCachedIcon }, names, (name, ex) => {
          consoleLogger.warn(
            `"${source.name}" failed to load "${name}" while listing its collection: ${ex instanceof Error ? ex.message : ex}`,
          );
        });
        return { entries };
      } catch (ex) {
        return { error: ex instanceof Error ? ex : new Error(String(ex)) };
      }
    },
  };
}
