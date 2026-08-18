import type { LiveLoader } from "astro/loaders";
import { AstroIconError } from "../internal/error.js";
import { buildIcons } from "./buildIcons.js";
import { consoleLogger } from "./logger.js";
import { mergeSources } from "./compositeSource.js";
import { sanitizeSVGBody } from "./sanitizeSVG.js";
import { recordCollection } from "./typegen/index.js";
import type { IconSource } from "./source.js";
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
 * import { createLiveIconLoader, iconifyLocalSource } from "astro-icon/loaders/live";
 *
 * export const collections = {
 *   mdi: defineLiveCollection({
 *     loader: createLiveIconLoader(iconifyLocalSource("mdi", { icons: ["home"] })),
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
): LiveLoader<IconEntry, { id: string }, never> {
  const source = mergeSources(sources);
  const cache = new Map<string, IconEntry>();

  // Best-effort typegen at construction time, since `LiveLoader`'s context exposes no project root or collection name.
  // `LiveCollectionName` only needs the collection key to exist: a live collection's specific icons resolve per
  // request and are never validated against a catalog (see names.d.ts), so this records an empty list rather than
  // resolving the source's full catalog just to discard it. `listIcons()` is still called for its side effect:
  // sources like `iconifyLocalSource` use it to record their own full pack catalog for typing the `icons: [...]` option.
  const rootDir = new URL(`file://${process.cwd()}/`);
  if (source.listIcons) source.listIcons().catch(() => {});
  recordCollection(rootDir, "live", source.name, []).catch(() => {});

  async function getCachedIcon(name: string): Promise<IconEntry> {
    const cached = cache.get(name);
    if (cached) return cached;
    const built = await source.getIcon(name);
    // Sanitized here, not left to `parseIconSVG`, so a custom `IconSource` backing this live
    // loader - the lowest-trust case, since its content was never validated by this library -
    // can't bypass it by building its `IconEntry` some other way. Cached post-sanitize, so the
    // cost is paid once per unique icon name for the process lifetime, not per request.
    const entry = { ...built, body: sanitizeSVGBody(built.body) };
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
        const built = await buildIcons(
          { getIcon: getCachedIcon },
          names,
          (name, ex) => {
            consoleLogger.warn(
              `"${source.name}" failed to load "${name}" while listing its collection: ${ex instanceof Error ? ex.message : ex}`,
            );
          },
        );
        // `name` -> `id` only here, where astro-icon's own vocabulary crosses into `LiveLoader`'s.
        return { entries: built.map(({ name, data }) => ({ id: name, data })) };
      } catch (ex) {
        return { error: ex instanceof Error ? ex : new Error(String(ex)) };
      }
    },
  };
}
