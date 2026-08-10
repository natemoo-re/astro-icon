import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { IconifyJSON } from "@iconify/types";
import { getIconData, iconToHTML, iconToSVG } from "@iconify/utils";
import type { AstroIntegrationLogger } from "astro";
import { resolveLocalPack, resolvePack } from "./resolvePack.js";
import { AstroIconError } from "../core/AstroIconError.js";
import { consoleLogger } from "../core/logger.js";
import { parseIconSVG } from "../core/parseIconSVG.js";
import type { IconSource } from "../core/iconSource.js";
import type { IconEntry, IconifySourceOptions, OptimizeFn } from "../../typings/types";

/**
 * The installed `@iconify-json/<pack>`'s own npm `version` - a cheap
 * freshness signal for `createIconLoader`'s version-based skip (see
 * `IconSource.getVersion`). Undefined for anything that isn't a plain
 * local install (not found, or resolved via the API-fallback path, which
 * has no version to key off of) - the loader always falls back to a full
 * resolve in that case.
 *
 * Resolved from `process.cwd()`, the same base `loadCollectionFromFS` (via
 * `@iconify/utils`) uses to find the pack itself - `import.meta.resolve`
 * would instead resolve relative to *this* file's own location, which in
 * a pnpm workspace can't see a sibling package's dependencies (the pack is
 * installed for the Astro project consuming astro-icon, not for
 * astro-icon's own package directory).
 */
async function getPackVersion(pack: string): Promise<string | undefined> {
  try {
    const require = createRequire(join(process.cwd(), "package.json"));
    const pkgPath = require.resolve(`@iconify-json/${pack}/package.json`);
    const raw = await readFile(pkgPath, "utf-8");
    const version = JSON.parse(raw)?.version;
    return typeof version === "string" ? version : undefined;
  } catch {
    return undefined;
  }
}

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
    getVersion() {
      return getPackVersion(pack);
    },
  };
}

export interface BuildIconEntryOptions {
  collection: string;
  optimize?: OptimizeFn;
  strict?: boolean;
  logger: Pick<AstroIntegrationLogger, "warn">;
}

/**
 * Renders a single icon out of a resolved iconify pack (see `resolvePack`)
 * into an `IconEntry`, running it through `optimize` if given.
 */
export async function buildIconEntry(
  data: IconifyJSON,
  name: string,
  { collection, optimize, strict = false, logger }: BuildIconEntryOptions,
): Promise<IconEntry | undefined> {
  const iconData = getIconData(data, name);
  if (!iconData) return undefined;

  const rendered = iconToSVG(iconData);
  const svg = iconToHTML(rendered.body, rendered.attributes);

  return parseIconSVG(svg, {
    collection,
    name,
    optimize,
    strict,
    logger,
    fallbackSize: { width: rendered.viewBox[2], height: rendered.viewBox[3] },
  });
}
