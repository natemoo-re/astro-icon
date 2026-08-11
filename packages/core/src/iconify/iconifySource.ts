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
import { recordPack } from "../typegen.js";
import type { IconSource } from "../core/iconSource.js";
import type { IconEntry, IconifySourceOptions, OptimizeFn } from "../../typings/types";
import type { IconifyIconName } from "../../typings/names";

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

/** Every icon name (including aliases) in a resolved local pack. */
function localPackIconNames(data: IconifyJSON): string[] {
  return Object.keys(data.icons).concat(Object.keys(data.aliases ?? {}));
}

// Packs already recorded for typegen in this process, so a busy collection doesn't re-run the write chain per icon.
const recordedPacks = new Set<string>();

/**
 * Best-effort typegen: records a locally resolved pack's full, unfiltered
 * catalog so `icons: [...]` can be typed and autocompleted against it on a
 * later run. Only called with data that already came from a local pack
 * resolution done for real work (never fetched just for this), so it never
 * touches the pack on its own. Fetching it here would break the documented
 * "an `icons` allowlist alone never requires a local install" contract.
 */
function recordPackCatalog(pack: string, data: IconifyJSON): void {
  if (recordedPacks.has(pack)) return;
  recordedPacks.add(pack);
  // `iconifySource` has no access to the project root the way a `LoaderContext` does; mirrors `createLiveIconLoader`'s own `process.cwd()` fallback.
  const rootDir = new URL(`file://${process.cwd()}/`);
  recordPack(rootDir, pack, localPackIconNames(data)).catch(() => {});
}

export function iconifySource<
  Pack extends string,
  const Icons extends readonly IconifyIconName<Pack>[] = readonly IconifyIconName<Pack>[],
>(
  pack: Pack,
  options?: Omit<IconifySourceOptions, "icons"> & { icons?: Icons },
): IconSource;
/**
 * An {@link IconSource} backed by a single Iconify icon pack. `iconify()`
 * uses this internally; reach for it directly when you compose sources
 * yourself, for example combining two packs into one collection with
 * `createIconLoader` or building a custom {@link IconSource}-based live
 * loader with `createLiveIconLoader`.
 *
 * Prefers a local `@iconify-json/<pack>` install, falling back to fetching
 * each requested icon individually from the public Iconify API.
 *
 * The `icons: [...]` option is typed and autocompleted against the pack's
 * own catalog. A duplicate name in that array is deduped and logged as a
 * warning at runtime, not rejected at the type level. Both only kick in once
 * astro-icon has recorded the pack's full icon list from a previous sync
 * (`astro sync`/`dev`/`build`); until then it falls back to a plain `string`.
 */
export function iconifySource(
  pack: string,
  options: IconifySourceOptions = {},
): IconSource {
  const { icons, optimize, strict = false } = options;
  const allowed = icons && new Set(icons);
  const logger = consoleLogger;

  if (icons && allowed && allowed.size !== icons.length) {
    const seen = new Set<string>();
    const duplicates = icons.filter((name) => seen.size === seen.add(name).size);
    logger.warn(
      `"${pack}"'s \`icons: [...]\` option repeats ${duplicates.length === 1 ? "a name" : "names"}: ${[...new Set(duplicates)].map((name) => `"${name}"`).join(", ")}. Duplicates are silently deduped; remove the repeat(s) to avoid confusion.`,
    );
  }

  return {
    name: pack,
    async getIcon(name) {
      if (allowed && !allowed.has(name)) {
        throw new AstroIconError(
          `"${name}" isn't in the allowed icon list for "${pack}" (${icons!.length} icon(s) allowed).`,
          `Add "${name}" to the \`icons: [...]\` option for this source, or remove the option to allow the whole pack.`,
        );
      }
      const local = await resolveLocalPack(pack);
      if (local) recordPackCatalog(pack, local);
      const data = local ?? (await resolvePack(pack, [name], { strict, logger }));
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
      // Not verified against the pack upfront, matching getIcon's own lazy check. `allowed` is a Set, so this also dedupes the option.
      if (allowed) return [...allowed];

      const local = await resolveLocalPack(pack);
      if (!local) {
        throw new AstroIconError(
          `"${pack}" isn't installed locally, so its full icon list can't be resolved from the Iconify API.`,
          `Install "@iconify-json/${pack}", or restrict it with an explicit \`icons: [...]\` list.`,
        );
      }
      recordPackCatalog(pack, local);
      return localPackIconNames(local);
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
