import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { IconifyJSON } from "@iconify/types";
import { getIconData, iconToHTML, iconToSVG } from "@iconify/utils";
import type { AstroIntegrationLogger } from "astro";
import { loadLocalPack, loadPackFromAPI } from "./pack.js";
import { resolveIconifyPackFile } from "./requireResolvePack.js";
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

/** Drops a trailing path separator (e.g. from `fileURLToPath` on a directory URL, which always ends in one) so it compares equal to a bare `process.cwd()`. */
function stripTrailingSlash(path: string): string {
  return path.length > 1 ? path.replace(/[\\/]+$/, "") : path;
}

/** The installed `@iconify-json/<pack>`'s npm version, or `undefined` if not locally installed; used as `IconSource.getVersion`'s freshness signal. */
async function getPackVersion(
  pack: string,
  cwd: string,
): Promise<string | undefined> {
  try {
    const pkgPath = resolveIconifyPackFile(pack, "package.json", cwd);
    if (!pkgPath) return undefined;
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
function recordPackCatalog(pack: string, data: IconifyJSON, cwd: string): void {
  if (recordedPacks.has(pack)) return;
  recordedPacks.add(pack);
  const rootDir = new URL(`file://${cwd}/`);
  recordCatalog(rootDir, pack, localPackIconNames(data)).catch(() => {});
}

/**
 * Anchors one `iconifyLocalSource(pack, ...)` instance to a project root, so `cwd` itself never
 * has to be threaded through the returned `IconSource`'s own methods - they call `getVersion()`/
 * `loadedPack()` without it, and read the actively-loading pack off `packPromise`.
 *
 * Starts loading immediately, against a `process.cwd()` guess (the only root available until
 * `resolveRoot`, if ever, anchors this to the real one - see `IconSource.resolveRoot`'s doc
 * comment for why the two can differ, e.g. `astro build --root <dir>` invoked from elsewhere),
 * so a source used directly, outside either bundled loader, still fails at construction rather
 * than never checking at all. `resolveRoot` only restarts the load if the accurate root actually
 * differs from that guess, so the common case (the two already match) pays nothing extra.
 */
function createPackAnchor(pack: string) {
  let cwd = process.cwd();
  let packPromise = loadLocalPack(pack, cwd);
  packPromise.catch(() => {});

  return {
    /** The pack as loaded so far, still `undefined` if it isn't installed - only `checkPreconditions` cares about that case. */
    get packPromise(): Promise<IconifyJSON | undefined> {
      return packPromise;
    },
    /**
     * The loaded pack, with its catalog recorded for typegen along the way.
     *
     * Non-null: trusts `checkPreconditions()` already confirmed the pack is installed (both
     * bundled loaders call it first). Only unsound for a source used directly, outside either
     * loader - see the source's own `checkPreconditions()` comment.
     */
    async loadedPack(): Promise<IconifyJSON> {
      const data = (await packPromise)!;
      recordPackCatalog(pack, data, cwd);
      return data;
    },
    resolveRoot(root: URL): void {
      const resolved = stripTrailingSlash(fileURLToPath(root));
      if (resolved === cwd) return;
      cwd = resolved;
      packPromise = loadLocalPack(pack, cwd);
      packPromise.catch(() => {});
    },
    getVersion(): Promise<string | undefined> {
      return getPackVersion(pack, cwd);
    },
  };
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

/** Everything a backing store - a local install vs. the public Iconify API - has to answer for; the allowlist accounting, error shapes and entry building around it are identical either way. */
interface IconifyBackend {
  /** Loads the pack backing one `getIcon(name)` call, already validated/recorded as that store needs. */
  loadPack(name: string): Promise<IconifyJSON>;
  /** `listIcons()` for a source no `allowed: [...]` restricts: a local install enumerates its pack, the API has nothing to enumerate and rejects. */
  listAllIcons(): Promise<string[]>;
  resolveRoot?(root: URL): void;
  checkPreconditions?(): Promise<void>;
  getVersion?(): Promise<string | undefined>;
}

/** The entire local-vs-API difference, in one literal per source. */
interface IconifySourceSpec {
  /** Prefixes `IconSource.name`, e.g. `iconify-local:mdi`. */
  namePrefix: string;
  /** The exported constructor's own name, so a warning names the source the user configured. */
  label: string;
  /** How the allowlist-rejection error's second sentence should finish - "the whole pack" (local) vs. "any icon name" (API). */
  allowlistHint: string;
  /** See `IconSource.concurrency`; omitted where there's no shared resource to protect. */
  concurrency?: number;
  createBackend(context: {
    pack: string;
    allowed: Set<string> | undefined;
    logger: Pick<AstroIntegrationLogger, "warn" | "debug">;
  }): IconifyBackend;
}

/** The skeleton both Iconify sources are: allowlist bookkeeping, allowlist-check-then-build `getIcon`, and `listIcons()` over the allowlist - all of it delegating to `spec` wherever local and API genuinely differ. */
function createIconifySource(
  spec: IconifySourceSpec,
  pack: string,
  options: IconifySourceOptions,
): IconSource {
  const { allowed: allowedList, optimize, strict = false } = options;
  const logger = consoleLogger;
  const allowed = checkForDuplicateIcons(pack, spec.label, allowedList, logger);
  const backend = spec.createBackend({ pack, allowed, logger });

  return {
    name: `${spec.namePrefix}:${pack}`,
    concurrency: spec.concurrency,
    resolveRoot: backend.resolveRoot,
    checkPreconditions: backend.checkPreconditions,
    getVersion: backend.getVersion,
    async getIcon(name) {
      if (allowed && !allowed.has(name)) {
        // Counts the `allowed: [...]` option's own length, not `allowed.size` - duplicates
        // included, since that's what "N icon(s) allowed" has always reported.
        throw new AstroIconError(
          `"${name}" isn't in the allowed icon list for "${pack}" (${allowedList?.length ?? 0} icon(s) allowed).`,
          `Add "${name}" to the \`allowed: [...]\` option for this source, or remove the option to allow ${spec.allowlistHint}.`,
        );
      }
      const data = await backend.loadPack(name);
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
      // Not verified against the pack upfront - `checkPreconditions()` owns "is this source
      // usable at all" as its own concern, called by both bundled loaders before this.
      // `allowed` is a Set, so this also dedupes the option.
      if (allowed) return [...allowed];
      return backend.listAllIcons();
    },
  };
}

const localSpec: IconifySourceSpec = {
  namePrefix: "iconify-local",
  label: "iconifyLocalSource",
  allowlistHint: "the whole pack",
  createBackend({ pack }) {
    // Started here, not inside getIcon/listIcons/checkPreconditions, so a missing pack fails the
    // build as soon as this source is constructed instead of only once the first icon is actually
    // requested - see createPackAnchor's own doc comment for the eager-load/resolveRoot details.
    const anchor = createPackAnchor(pack);

    return {
      resolveRoot(root) {
        anchor.resolveRoot(root);
      },
      // The eager pack load's actual "fail loudly, up front" payoff: called once by both bundled
      // loaders before listIcons/getIcon are ever touched, so a missing pack is one clear failure
      // instead of an `allowed` allowlist masking it in listIcons, surfacing only later as N
      // separate non-strict getIcon warnings once each icon is individually built. The only place
      // "pack isn't installed" is checked - `anchor.loadedPack()` below trusts it already ran
      // (both bundled loaders call this before either) and doesn't re-check `!data` itself.
      async checkPreconditions() {
        const data = await anchor.packPromise;
        if (!data) {
          throw new AstroIconError(
            `"${pack}" isn't installed locally.`,
            `Install it with \`npm install @iconify-json/${pack}\`, or use \`iconifyApiSource\` (see "astro-icon/loaders") to resolve it from the public Iconify API instead. If you only need a few icons, restrict this source with an explicit \`allowed: [...]\` list instead of installing the whole pack.`,
          );
        }
      },
      getVersion() {
        return anchor.getVersion();
      },
      loadPack() {
        return anchor.loadedPack();
      },
      async listAllIcons() {
        return localPackIconNames(await anchor.loadedPack());
      },
    };
  },
};

const apiSpec: IconifySourceSpec = {
  namePrefix: "iconify-api",
  label: "iconifyApiSource",
  allowlistHint: "any icon name",
  // A deliberate cap on a shared public resource, not a speed optimization (see
  // `IconSource.concurrency`). Batching (see `loadPack` below) already collapses concurrent
  // `getIcon` calls sharing an allowlist into one request, so this mostly guards call patterns
  // batching doesn't cover - a very large allowlist split into multiple chunk requests, or a
  // future change that reintroduces per-name fetches - rather than the common case.
  concurrency: 20,
  createBackend({ pack, allowed, logger }) {
    return {
      // With an allowlist, the whole set is known upfront - fetch it once (cached by
      // `loadPackFromAPI` under the full sorted list, so every other name in `allowed` hits
      // that same cached response) instead of one request per icon. Without one (e.g.
      // `<LiveIcon>` against a pack with no fixed set), there's nothing to batch against -
      // fetch just `name`.
      loadPack(name) {
        return loadPackFromAPI(pack, allowed ? [...allowed] : [name], {
          logger,
        });
      },
      async listAllIcons(): Promise<never> {
        throw new AstroIconError(
          `"${pack}" has no \`allowed: [...]\` list, so \`iconifyApiSource\` has no fixed set of icon names to report.`,
          `Add an explicit \`allowed: [...]\` list, or use \`iconifyLocalSource\` (needs "@iconify-json/${pack}" installed) for the whole pack.`,
        );
      },
    };
  },
};

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
 * package only - never the public Iconify API. Throws if the pack isn't
 * installed; there's no fallback built in, by design (see
 * {@link iconifyApiSource} and `mergeSources` for composing one yourself).
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
  return createIconifySource(localSpec, pack, options);
}

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
 */
export function iconifyApiSource(
  pack: string,
  options: IconifySourceOptions = {},
): IconSource {
  return createIconifySource(apiSpec, pack, options);
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
