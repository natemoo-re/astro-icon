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
import { createRateLimiter } from "../../utils/rateLimiter.js";
import type {
  IconEntry,
  IconifyApiSourceOptions,
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
 * catalog so `allowed: [...]` can be typed and autocompleted against it on a
 * later run. Only called with data that already came from a local pack
 * load done for real work (never fetched just for this), so it never
 * touches the pack on its own. Fetching it here would break the documented
 * "an `allowed` allowlist alone never requires a local install" contract.
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
  allowedNames: readonly string[] | undefined,
  logger: Pick<AstroIntegrationLogger, "warn">,
): Set<string> | undefined {
  if (!allowedNames) return undefined;
  const allowed = new Set(allowedNames);
  if (allowed.size !== allowedNames.length) {
    const seen = new Set<string>();
    const duplicates = allowedNames.filter(
      (name) => seen.size === seen.add(name).size,
    );
    logger.warn(
      `"${pack}"'s \`allowed: [...]\` option repeats ${duplicates.length === 1 ? "a name" : "names"}: ${[...new Set(duplicates)].map((name) => `"${name}"`).join(", ")} (${sourceLabel}). Duplicates are silently deduped; remove the repeat(s) to avoid confusion.`,
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
  options?: Omit<IconifySourceOptions, "allowed"> & { allowed?: Icons },
): IconSource;
/**
 * An {@link IconSource} backed by a locally installed `@iconify-json/<pack>`
 * package only - never the public Iconify API. Throws (from `getIcon`/
 * `listIcons`) if the pack isn't installed; there's no fallback built in, by
 * design (see {@link iconifyApiSource} and `mergeSources` for composing one
 * yourself). Resolving the pack starts immediately, at construction time,
 * rather than waiting for the first icon request - so a missing pack surfaces
 * as soon as anything awaits this source, not only once a build gets around
 * to resolving its first icon.
 *
 * The `allowed: [...]` option is typed and autocompleted against the pack's
 * own catalog, once astro-icon has recorded it from a previous sync
 * (`astro sync`/`dev`/`build`); until then it falls back to a plain
 * `string`. A duplicate name in that array is deduped and logged as a
 * warning at runtime, not rejected at the type level.
 */
export function iconifyLocalSource(
  pack: string,
  options: IconifySourceOptions = {},
): IconSource {
  const { allowed: allowedList, optimize, strict = false } = options;
  const logger = consoleLogger;
  const allowed = checkForDuplicateIcons(
    pack,
    "iconifyLocalSource",
    allowedList,
    logger,
  );

  // Started here, not inside getIcon/listIcons, so a missing pack fails the build as soon as
  // this source is constructed instead of only once the first icon is actually requested.
  // `loadLocalPack` caches by `pack` (see `packCache` in pack.ts), so kicking it off eagerly
  // costs nothing extra - getIcon/listIcons below await this exact same promise, they don't
  // trigger a second load. A source that's constructed but never used (e.g. one branch of a
  // conditional) would otherwise leave this rejection unhandled - the `.catch(() => {})` here is
  // only to silence that warning at the process level; getIcon/listIcons still await
  // `packPromise` itself and see the real rejection/undefined result.
  const packPromise = loadLocalPack(pack);
  packPromise.catch(() => {});

  return {
    name: `iconify-local:${pack}`,
    async getIcon(name) {
      if (allowed && !allowed.has(name)) {
        throw new AstroIconError(
          `"${name}" isn't in the allowed icon list for "${pack}" (${allowedList!.length} icon(s) allowed).`,
          `Add "${name}" to the \`allowed: [...]\` option for this source, or remove the option to allow the whole pack.`,
        );
      }
      const data = await packPromise;
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

      const data = await packPromise;
      if (!data) {
        throw new AstroIconError(
          `"${pack}" isn't installed locally.`,
          `Install "@iconify-json/${pack}", or restrict it with an explicit \`allowed: [...]\` list.`,
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
  options?: Omit<IconifyApiSourceOptions, "allowed"> & { allowed?: Icons },
): IconSource;
/**
 * An {@link IconSource} backed by the public Iconify API only - never a
 * local install. `getIcon` resolves any icon name from the pack one at a
 * time regardless of `allowed`, useful for `<LiveIcon>` against a pack you
 * don't want to install; the API can't return "the whole pack" the way a
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
 *
 * Requests already retry a 429 with backoff automatically. Pass `requestsPerSecond` to also cap
 * how often this source *starts* a new request against the public API in the first place.
 */
export function iconifyApiSource(
  pack: string,
  options: IconifyApiSourceOptions = {},
): IconSource {
  const {
    allowed: allowedList,
    optimize,
    strict = false,
    requestsPerSecond,
  } = options;
  const logger = consoleLogger;
  const allowed = checkForDuplicateIcons(
    pack,
    "iconifyApiSource",
    allowedList,
    logger,
  );
  const rateLimiter = requestsPerSecond
    ? createRateLimiter(requestsPerSecond)
    : undefined;

  return {
    name: `iconify-api:${pack}`,
    // A deliberate cap on a shared public resource, not a speed optimization (see
    // `IconSource.concurrency`). Batching (above) already collapses concurrent `getIcon` calls
    // sharing an allowlist into one request, so this mostly guards call patterns batching
    // doesn't cover - a very large allowlist split into multiple chunk requests, or a future
    // change that reintroduces per-name fetches - rather than the common case.
    concurrency: 20,
    async getIcon(name) {
      if (allowed && !allowed.has(name)) {
        throw new AstroIconError(
          `"${name}" isn't in the allowed icon list for "${pack}" (${allowedList!.length} icon(s) allowed).`,
          `Add "${name}" to the \`allowed: [...]\` option for this source, or remove the option to allow any icon name.`,
        );
      }
      // With an allowlist, the whole set is known upfront - fetch it once (cached by
      // `loadPackFromAPI` under the full sorted list, so every other name in `allowed` hits that
      // same cached response) instead of one request per icon. Without one (e.g. `<LiveIcon>`
      // against a pack with no fixed set), there's nothing to batch against - fetch just `name`.
      const data = await loadPackFromAPI(
        pack,
        allowed ? [...allowed] : [name],
        {
          logger,
          rateLimiter,
        },
      );
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
        `"${pack}" has no \`allowed: [...]\` list, so its full icon set can't be enumerated from the Iconify API.`,
        `Add an explicit \`allowed: [...]\` list, or use \`iconifyLocalSource\` (needs "@iconify-json/${pack}" installed) for the whole pack.`,
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
