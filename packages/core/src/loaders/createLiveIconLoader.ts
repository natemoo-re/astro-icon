import type { LiveLoader } from "astro/loaders";
import { AstroIconError } from "../core/AstroIconError.js";
import { consoleLogger } from "../core/logger.js";
import { mergeSources } from "../core/mergeSources.js";
import { resolveAllIcons } from "../core/resolveAllIcons.js";
import { recordCollection } from "../typegen.js";
import type { IconSource } from "../core/iconSource.js";
import type { IconEntry } from "../../typings/types";

/**
 * Builds a live content collection loader around one or more `IconSource`s,
 * handling the per-request plumbing every icon source needs: caching
 * resolved entries for the lifetime of the server process, wrapping thrown
 * errors as `{ error }`, and (when the source supports it) fulfilling
 * whole-collection loads via `listIcons` + `getIcon`.
 *
 * Passing multiple sources combines them into one live collection: each
 * icon is resolved by trying sources in order and using the first one that
 * has it.
 */
export function createLiveIconLoader(
  sources: IconSource | IconSource[],
): LiveLoader<IconEntry, { id: string }, never> {
  const source = mergeSources(sources);
  const cache = new Map<string, IconEntry>();

  // Best-effort typegen, fired once at construction time (not per-request -
  // `LiveLoader`'s context never exposes the project root or the
  // collection's own name, so this relies on `process.cwd()` and on
  // `source.name` matching the collection key). If the source can list its
  // icons, generated types offer all of them for autocomplete; otherwise
  // (no `listIcons`, or it fails - e.g. an API-only iconify pack with no
  // local install) this collection falls back to typing as a plain `string`.
  const rootDir = new URL(`file://${process.cwd()}/`);
  const names = source.listIcons ? source.listIcons().catch(() => []) : Promise.resolve([]);
  names
    .then((resolved) => recordCollection(rootDir, "live", source.name, resolved))
    .catch(() => {});

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
