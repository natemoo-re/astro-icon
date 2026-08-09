import { buildIconEntry } from "./buildIconEntry.js";
import { resolveLocalPack, resolvePack } from "./resolvePack.js";
import { AstroIconError } from "../core/AstroIconError.js";
import { consoleLogger } from "../core/logger.js";
import type { IconSource } from "../core/iconSource.js";
import type { IconifySourceOptions } from "../../typings/types";

/**
 * An `IconSource` backed by a single Iconify icon pack. Prefers a locally
 * installed `@iconify-json/<pack>` package; otherwise resolves each
 * requested icon individually from the public Iconify API, which only
 * supports fetching specific icons - not an entire pack - per request.
 *
 * Pack resolution is cached at the module level (see `resolvePack` in
 * `iconify/resolvePack.ts`), so this is cheap to call repeatedly and shares
 * its result with any other source using the same pack.
 */
export function iconifySource(
  pack: string,
  options: IconifySourceOptions = {},
): IconSource {
  const { icons, optimize, strict = false } = options;
  const allowed = icons && new Set(icons);
  const logger = consoleLogger;

  return {
    // Matches the pack name - if a collection is named the same way
    // (astro-icon's own convention, e.g. `mdi: defineCollection({ loader:
    // iconify("mdi") })`), typegen keys line up correctly.
    name: pack,
    async getIcon(name) {
      if (allowed && !allowed.has(name)) {
        throw new AstroIconError(
          `"${name}" isn't in the allowed icon list for "${pack}" (${icons!.length} icon(s) allowed).`,
          `Add "${name}" to the \`icons: [...]\` option for this source, or remove the option to allow the whole pack.`,
        );
      }
      const data =
        (await resolveLocalPack(pack)) ??
        (await resolvePack(pack, [name], { strict, logger }));
      const entry = await buildIconEntry(data, name, {
        collection: pack,
        optimize,
        strict,
        logger,
      });
      if (!entry) {
        throw new AstroIconError(
          `"${pack}" does not include an icon named "${name}".`,
          `Check the icon's name at https://icon-sets.iconify.design/${pack}/, or that you didn't mean a different pack.`,
        );
      }
      return entry;
    },
    async listIcons() {
      // An explicit allowlist is typed exactly as given, the same way it's
      // enforced in getIcon - not verified upfront against the pack.
      if (allowed) return [...icons!];

      const local = await resolveLocalPack(pack);
      if (!local) {
        throw new AstroIconError(
          `"${pack}" isn't installed locally, so its full icon list can't be resolved from the Iconify API.`,
          `Install "@iconify-json/${pack}", or restrict it with an explicit \`icons: [...]\` list.`,
        );
      }
      return Object.keys(local.icons).concat(Object.keys(local.aliases ?? {}));
    },
  };
}
