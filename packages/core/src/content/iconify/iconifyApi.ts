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
import type { IconifyApiSourceOptions } from "../../../typings/types";
import type { IconifyIconName } from "../../../typings/names";

export function iconifyApi<
  Pack extends string,
  const Icons extends readonly IconifyIconName<Pack>[] =
    readonly IconifyIconName<Pack>[],
>(
  pack: Pack,
  options?: Omit<IconifyApiSourceOptions, "allowed"> & { allowed?: Icons },
): IconSource;
/**
 * An {@link IconSource} backed by the public Iconify API only - never a
 * local install. `getIcons` resolves any icon names from the pack in one
 * batched request regardless of `allowed`, useful for `<LiveIcon>` against a
 * pack you don't want to install; the API can't return "the whole pack" the way a
 * local install can, so omitting `allowed` (an explicit allowlist) also
 * means `listIcons()` throws instead of pretending to enumerate one.
 *
 * Resolves from the public `api.iconify.design` by default; point `host` at
 * a self-hosted Iconify API instance
 * (https://iconify.design/docs/api/hosting.html) to keep icon traffic
 * on your own infrastructure.
 *
 * Meant either standalone (e.g. deliberately avoiding an install) or
 * composed after `iconify` in a source array for a local-preferred,
 * API-fallback collection:
 *
 * ```ts
 * import { defineIconCollection, iconifyApi, iconify } from "astro-icon/collections";
 *
 * export const collections = {
 *   mdi: defineIconCollection([
 *     iconify("mdi", { allowed: ["home"] }),
 *     iconifyApi("mdi", { allowed: ["home"] }),
 *   ]),
 * };
 * ```
 */
export function iconifyApi(
  pack: string,
  options: IconifyApiSourceOptions = {},
): IconSource {
  const { allowed: allowedList, transform, host } = options;
  const logger = consoleLogger;
  const allowed = dedupeAllowed(pack, "iconifyApi", allowedList, logger);
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
          { logger, host },
        );
        await addPackEntries(result, data, toFetch, pack, transform);
      }
      return result;
    },
    async listIcons() {
      // `allowed` is a Set, so this also dedupes the option.
      if (allowed) return [...allowed];
      throw new AstroIconError(
        `"${pack}" has no \`allowed: [...]\` list, so \`iconifyApi\` has no fixed set of icon names to report.`,
        `Add an explicit \`allowed: [...]\` list, or use \`iconify\` (needs "@iconify-json/${pack}" installed) for the whole pack.`,
      );
    },
  };
}
