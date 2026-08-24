import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { IconifyJSON } from "@iconify/types";
import type { AstroIntegrationLogger } from "astro";
import { loadLocalPack, loadPackFromAPI } from "./pack.js";
import { resolveIconifyPackFile } from "./requireResolvePack.js";
import { AstroIconError } from "../../internal/error.js";
import { consoleLogger } from "../logger.js";
import { entryFromIconifyData } from "../ingest/entryFromIconifyData.js";
import { recordCatalog } from "../typegen/index.js";
import type { IconSource } from "../source.js";
import type {
  IconEntry,
  IconifySourceOptions,
  TransformFn,
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
  /**
   * Loads the pack backing one `getIcons(names)` call, already validated/recorded as that store
   * needs. `names` is the whole batch this source was asked to build (minus any allowlist
   * rejections, filtered out before this is called) - a local install ignores it and returns its
   * one already-loaded pack regardless; the API backend uses it as the `?icons=a,b,c` request
   * body when there's no fixed `allowed` set to fetch instead.
   */
  loadPack(names: string[]): Promise<IconifyJSON>;
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
  createBackend(context: {
    pack: string;
    allowed: Set<string> | undefined;
    logger: Pick<AstroIntegrationLogger, "warn" | "debug">;
  }): IconifyBackend;
}

/** The skeleton both Iconify sources are: allowlist bookkeeping, allowlist-check-then-batch-build `getIcons`, and `listIcons()` over the allowlist - all of it delegating to `spec` wherever local and API genuinely differ. */
function createIconifySource(
  spec: IconifySourceSpec,
  pack: string,
  options: IconifySourceOptions,
): IconSource {
  const { allowed: allowedList, transform } = options;
  const logger = consoleLogger;
  const allowed = checkForDuplicateIcons(pack, spec.label, allowedList, logger);
  const backend = spec.createBackend({ pack, allowed, logger });

  return {
    name: `${spec.namePrefix}:${pack}`,
    resolveRoot: backend.resolveRoot,
    checkPreconditions: backend.checkPreconditions,
    getVersion: backend.getVersion,
    async getIcons(names) {
      const result = new Map<string, IconEntry | Error>();
      const toFetch: string[] = [];
      for (const name of names) {
        if (allowed && !allowed.has(name)) {
          // Counts the `allowed: [...]` option's own length, not `allowed.size` - duplicates
          // included, since that's what "N icon(s) allowed" has always reported.
          result.set(
            name,
            new AstroIconError(
              `"${name}" isn't in the allowed icon list for "${pack}" (${allowedList?.length ?? 0} icon(s) allowed).`,
              `Add "${name}" to the \`allowed: [...]\` option for this source, or remove the option to allow ${spec.allowlistHint}.`,
            ),
          );
        } else {
          toFetch.push(name);
        }
      }
      if (toFetch.length > 0) {
        const data = await backend.loadPack(toFetch);
        for (const name of toFetch) {
          const entry = entryFromIconifyData(data, name);
          if (!entry) {
            result.set(
              name,
              new AstroIconError(
                `"${pack}" does not include an icon named "${name}".`,
                `Check the icon's name at https://icon-sets.iconify.design/${pack}/, or that you didn't mean a different pack.`,
              ),
            );
            continue;
          }
          result.set(
            name,
            transform ? await transform(entry, { collection: pack, name }) : entry,
          );
        }
      }
      return result;
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
    // Started here, not inside getIcons/listIcons/checkPreconditions, so a missing pack fails
    // the build as soon as this source is constructed instead of only once the first icon is
    // actually requested - see createPackAnchor's own doc comment for the eager-load/resolveRoot
    // details.
    const anchor = createPackAnchor(pack);

    return {
      resolveRoot(root) {
        anchor.resolveRoot(root);
      },
      // The eager pack load's actual "fail loudly, up front" payoff: called once by both bundled
      // loaders before listIcons/getIcons are ever touched, so a missing pack is one clear
      // failure instead of an `allowed` allowlist masking it in listIcons, surfacing only later
      // as a per-icon getIcons warning (in dev) once each icon is individually built. The only place
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
      // Ignores `names`: a local install has the whole pack in memory either way, so there's
      // nothing to narrow the fetch to.
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
  createBackend({ pack, allowed, logger }) {
    return {
      // With an allowlist, the whole set is known upfront - fetch it (cached by
      // `loadPackFromAPI` under the full sorted list, so every `getIcons` call against this
      // source hits that same cached response) instead of whatever subset `names` happens to be.
      // Without one (e.g. a live search against a pack with no fixed set), `names` *is* the
      // batch: every name `getIcons` was asked to build in this call, fetched in one request
      // regardless of how many that is - `loadPackFromAPI` itself splits a very large list across
      // multiple chunked requests, run concurrently (see `MAX_ICONS_PER_REQUEST` in pack.ts).
      loadPack(names) {
        return loadPackFromAPI(pack, allowed ? [...allowed] : names, {
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
  return createIconifySource(apiSpec, pack, options);
}
