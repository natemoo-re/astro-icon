import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { IconifyJSON } from "@iconify/types";
import { getIconData, iconToHTML, iconToSVG } from "@iconify/utils";
import type { AstroIntegrationLogger } from "astro";
import { loadLocalPack, loadPackFromAPI } from "./pack.js";
import { AstroIconError } from "../../internal/error.js";
import { consoleLogger } from "../logger.js";
import { parseIconSVG } from "../parseIconSVG.js";
import { recordCatalog } from "../typegen/index.js";
import type { IconSource } from "../source.js";
import type {
  IconEntry,
  IconifySourceOptions,
  OptimizeFn,
} from "../../../typings/types";
import type { IconifyIconName } from "../../../typings/names";

/** The installed `@iconify-json/<pack>`'s npm version, or `undefined` if not locally installed; used as `IconSource.getVersion`'s freshness signal. */
async function getPackVersion(pack: string): Promise<string | undefined> {
  try {
    // cwd, not import.meta.resolve, to reach the consuming project's install in a pnpm workspace.
    const require = createRequire(join(process.cwd(), "package.json"));
    const pkgPath = require.resolve(`@iconify-json/${pack}/package.json`);
    const raw = await readFile(pkgPath, "utf-8");
    const version: unknown = JSON.parse(raw)?.version;
    return version == null ? undefined : String(version);
  } catch {
    return undefined;
  }
}

/** Every icon name (including aliases) in a loaded local pack. */
function localPackIconNames(data: IconifyJSON): string[] {
  return Object.keys(data.icons).concat(Object.keys(data.aliases ?? {}));
}

// Packs already recorded for typegen in this process, so a busy collection doesn't re-run the write chain per icon.
const recordedPacks = new Set<string>();

/**
 * Best-effort typegen: records a locally loaded pack's full, unfiltered
 * catalog so `icons: [...]` can be typed and autocompleted against it on a
 * later run. Only called with data that already came from a local pack
 * load done for real work (never fetched just for this), so it never
 * touches the pack on its own. Fetching it here would break the documented
 * "an `icons` allowlist alone never requires a local install" contract.
 */
function recordPackCatalog(pack: string, data: IconifyJSON): void {
  if (recordedPacks.has(pack)) return;
  recordedPacks.add(pack);
  // No access to the project root the way a `LoaderContext` does; mirrors `createLiveIconLoader`'s own `process.cwd()` fallback.
  const rootDir = new URL(`file://${process.cwd()}/`);
  recordCatalog(rootDir, pack, localPackIconNames(data)).catch(() => {});
}

function checkForDuplicateIcons(
  pack: string,
  sourceLabel: string,
  icons: readonly string[] | undefined,
  logger: Pick<AstroIntegrationLogger, "warn">,
): Set<string> | undefined {
  if (!icons) return undefined;
  const allowed = new Set(icons);
  if (allowed.size !== icons.length) {
    const seen = new Set<string>();
    const duplicates = icons.filter(
      (name) => seen.size === seen.add(name).size,
    );
    logger.warn(
      `"${pack}"'s \`icons: [...]\` option repeats ${duplicates.length === 1 ? "a name" : "names"}: ${[...new Set(duplicates)].map((name) => `"${name}"`).join(", ")} (${sourceLabel}). Duplicates are silently deduped; remove the repeat(s) to avoid confusion.`,
    );
  }
  return allowed;
}

export function iconifyLocalSource<
  Pack extends string,
  const Icons extends readonly IconifyIconName<Pack>[] =
    readonly IconifyIconName<Pack>[],
>(
  pack: Pack,
  options?: Omit<IconifySourceOptions, "icons"> & { icons?: Icons },
): IconSource;
/**
 * An {@link IconSource} backed by a locally installed `@iconify-json/<pack>`
 * package only - never the public Iconify API. Throws if the pack isn't
 * installed; there's no fallback built in, by design (see
 * {@link iconifyApiSource} and `mergeSources` for composing one yourself).
 *
 * The `icons: [...]` option is typed and autocompleted against the pack's
 * own catalog, once astro-icon has recorded it from a previous sync
 * (`astro sync`/`dev`/`build`); until then it falls back to a plain
 * `string`. A duplicate name in that array is deduped and logged as a
 * warning at runtime, not rejected at the type level.
 */
export function iconifyLocalSource(
  pack: string,
  options: IconifySourceOptions = {},
): IconSource {
  const { icons, optimize, strict = false } = options;
  const logger = consoleLogger;
  const allowed = checkForDuplicateIcons(
    pack,
    "iconifyLocalSource",
    icons,
    logger,
  );

  return {
    name: `iconify-local:${pack}`,
    async getIcon(name) {
      if (allowed && !allowed.has(name)) {
        throw new AstroIconError(
          `"${name}" isn't in the allowed icon list for "${pack}" (${icons!.length} icon(s) allowed).`,
          `Add "${name}" to the \`icons: [...]\` option for this source, or remove the option to allow the whole pack.`,
        );
      }
      const data = await loadLocalPack(pack);
      if (!data) {
        throw new AstroIconError(
          `"${pack}" isn't installed locally.`,
          `Install it with \`npm install @iconify-json/${pack}\`, or use \`iconifyApiSource\` (see "astro-icon/loaders") to resolve it from the public Iconify API instead.`,
        );
      }
      recordPackCatalog(pack, data);
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

      const data = await loadLocalPack(pack);
      if (!data) {
        throw new AstroIconError(
          `"${pack}" isn't installed locally.`,
          `Install "@iconify-json/${pack}", or restrict it with an explicit \`icons: [...]\` list.`,
        );
      }
      recordPackCatalog(pack, data);
      return localPackIconNames(data);
    },
    getVersion() {
      return getPackVersion(pack);
    },
  };
}

export function iconifyApiSource<
  Pack extends string,
  const Icons extends readonly IconifyIconName<Pack>[] =
    readonly IconifyIconName<Pack>[],
>(
  pack: Pack,
  options?: Omit<IconifySourceOptions, "icons"> & { icons?: Icons },
): IconSource;
/**
 * An {@link IconSource} backed by the public Iconify API only - never a
 * local install. `getIcon` resolves any icon name from the pack one at a
 * time regardless of `icons`, useful for `<LiveIcon>` against a pack you
 * don't want to install; the API can't return "the whole pack" the way a
 * local install can, so omitting `icons` (an explicit allowlist) also
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
 *   iconifyLocalSource("mdi", { icons: ["home"] }),
 *   iconifyApiSource("mdi", { icons: ["home"] }),
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
  const { icons, optimize, strict = false } = options;
  const logger = consoleLogger;
  const allowed = checkForDuplicateIcons(
    pack,
    "iconifyApiSource",
    icons,
    logger,
  );

  return {
    name: `iconify-api:${pack}`,
    async getIcon(name) {
      if (allowed && !allowed.has(name)) {
        throw new AstroIconError(
          `"${name}" isn't in the allowed icon list for "${pack}" (${icons!.length} icon(s) allowed).`,
          `Add "${name}" to the \`icons: [...]\` option for this source, or remove the option to allow any icon name.`,
        );
      }
      // With an allowlist, the whole set is known upfront - fetch it once (cached by
      // `loadPackFromAPI` under the full sorted list, so every other name in `allowed` hits that
      // same cached response) instead of one request per icon. Without one (e.g. `<LiveIcon>`
      // against a pack with no fixed set), there's nothing to batch against - fetch just `name`.
      const data = await loadPackFromAPI(pack, allowed ? [...allowed] : [name], {
        logger,
      });
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
      if (allowed) return [...allowed];
      throw new AstroIconError(
        `"${pack}" has no \`icons: [...]\` list, so its full icon set can't be enumerated from the Iconify API.`,
        `Add an explicit \`icons: [...]\` list, or use \`iconifyLocalSource\` (needs "@iconify-json/${pack}" installed) for the whole pack.`,
      );
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
 * Renders a single icon out of a loaded iconify pack (see `loadLocalPack`/`loadPackFromAPI`)
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
