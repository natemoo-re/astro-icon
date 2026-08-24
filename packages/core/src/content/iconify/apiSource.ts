import { loadPackFromAPI } from "./pack.js";
import {
  addPackEntries,
  allowlistRejection,
  dedupeAllowed,
  partitionAllowed,
} from "./shared.js";
import { AstroIconError } from "../../internal/error.js";
import { consoleLogger } from "../logger.js";
import type { IconSource } from "../source.js";
import type { IconifySourceOptions } from "../../../typings/types";
import type { IconifyIconName } from "../../../typings/names";

export function iconifyApiSource<
  Pack extends string,
  const Icons extends readonly IconifyIconName<Pack>[] =
    readonly IconifyIconName<Pack>[],
>(
  pack: Pack,
  options?: Omit<IconifySourceOptions, "allowed"> & { allowed?: Icons },
): IconSource;
/**
 * An {@link IconSource} backed by the public Iconify API only - never a
 * local install. `getIcons` resolves any icon names from the pack in one
 * batched request regardless of `allowed`, useful for `<LiveIcon>` against a
 * pack you don't want to install; the API can't return "the whole pack" the way a
 * local install can, so omitting `allowed` (an explicit allowlist) also
 * means `listIcons()` throws instead of pretending to enumerate one.
 *
 * Meant either standalone (e.g. deliberately avoiding an install) or
 * composed with `iconifyLocalSource` via `mergeSources` for a
 * local-preferred, API-fallback source:
 *
 * ```ts
 * import { createIconLoader, iconifyApiSource, iconifyLocalSource, mergeSources } from "astro-icon/loaders";
 *
 * const mdi = mergeSources([
 *   iconifyLocalSource("mdi", { allowed: ["home"] }),
 *   iconifyApiSource("mdi", { allowed: ["home"] }),
 * ]);
 *
 * export const collections = {
 *   mdi: defineCollection({ loader: createIconLoader(mdi) }),
 * };
 * ```
 */
export function iconifyApiSource(
  pack: string,
  options: IconifySourceOptions = {},
): IconSource {
  const { allowed: allowedList, transform } = options;
  const logger = consoleLogger;
  const allowed = dedupeAllowed(pack, "iconifyApiSource", allowedList, logger);
  // Counts the `allowed: [...]` option's own length, not `allowed.size` - duplicates included,
  // since that's what "N icon(s) allowed" has always reported.
  const rejection = allowlistRejection(
    pack,
    allowedList?.length ?? 0,
    "any icon name",
  );

  return {
    name: `iconify-api:${pack}`,
    async getIcons(names) {
      const { result, toFetch } = partitionAllowed(names, allowed, rejection);
      if (toFetch.length > 0) {
        // With an allowlist, the whole set is known upfront - fetch it (cached by
        // `loadPackFromAPI` under the full sorted list, so every `getIcons` call against this
        // source hits that same cached response) instead of whatever subset `toFetch` happens to
        // be. Without one (e.g. a live search against a pack with no fixed set), `toFetch` *is*
        // the batch, fetched in one request regardless of how many names that is -
        // `loadPackFromAPI` itself splits a very large list across multiple chunked requests, run
        // concurrently (see `MAX_ICONS_PER_REQUEST` in pack.ts).
        const data = await loadPackFromAPI(
          pack,
          allowed ? [...allowed] : toFetch,
          { logger },
        );
        await addPackEntries(result, data, toFetch, pack, transform);
      }
      return result;
    },
    async listIcons() {
      // `allowed` is a Set, so this also dedupes the option.
      if (allowed) return [...allowed];
      throw new AstroIconError(
        `"${pack}" has no \`allowed: [...]\` list, so \`iconifyApiSource\` has no fixed set of icon names to report.`,
        `Add an explicit \`allowed: [...]\` list, or use \`iconifyLocalSource\` (needs "@iconify-json/${pack}" installed) for the whole pack.`,
      );
    },
  };
}
