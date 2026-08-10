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

/** The installed `@iconify-json/<pack>`'s npm version, or `undefined` if not locally installed; used as `IconSource.getVersion`'s freshness signal. */
async function getPackVersion(pack: string): Promise<string | undefined> {
  try {
    // cwd, not import.meta.resolve, to reach the consuming project's install in a pnpm workspace.
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
 * An {@link IconSource} backed by a single Iconify icon pack. `iconify()`
 * uses this internally; reach for it directly when you compose sources
 * yourself, for example combining two packs into one collection with
 * `createIconLoader` or building a custom {@link IconSource}-based live
 * loader with `createLiveIconLoader`.
 *
 * Prefers a local `@iconify-json/<pack>` install, falling back to fetching
 * each requested icon individually from the public Iconify API.
 */
export function iconifySource(
  pack: string,
  options: IconifySourceOptions = {},
): IconSource {
  const { icons, optimize, strict = false } = options;
  const allowed = icons && new Set(icons);
  const logger = consoleLogger;

  return {
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
      // Not verified against the pack upfront, matching getIcon's own lazy check.
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
