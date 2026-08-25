import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { IconifyJSON } from "@iconify/types";
import { loadLocalPack } from "./pack.js";
import { resolveIconifyPackFile } from "./requireResolvePack.js";
import {
  addPackEntries,
  allowlistRejection,
  dedupeAllowed,
  partitionAllowed,
} from "./shared.js";
import { AstroIconError } from "../../internal/error.js";
import { consoleLogger } from "../logger.js";
import { recordCatalog } from "../typegen/index.js";
import type { IconSource } from "../source.js";
import type { IconifySourceOptions } from "../../../typings/types";
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

/**
 * Best-effort typegen: records a locally loaded pack's full, unfiltered
 * catalog so `allowed: [...]` can be typed and autocompleted against it on a
 * later run. Only called with data that already came from a local pack
 * load done for real work (never fetched just for this), so it never
 * touches the pack on its own. Fetching it here would break the documented
 * "an `allowed` allowlist alone never requires a local install" contract.
 * Dedupe per root+pack (so a busy collection doesn't re-run the write chain per icon) is the
 * recorder's own concern now, not this source's.
 */
function recordPackCatalog(pack: string, data: IconifyJSON, cwd: string): void {
  const rootDir = new URL(`file://${cwd}/`);
  recordCatalog(rootDir, pack, localPackIconNames(data)).catch(() => {});
}

export function iconify<
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
 * {@link iconifyApi} and `mergeSources` for composing one yourself).
 *
 * The `allowed: [...]` option is typed and autocompleted against the pack's
 * own catalog, once astro-icon has recorded it from a previous sync
 * (`astro sync`/`dev`/`build`); until then it falls back to a plain
 * `string`. A duplicate name in that array is deduped and logged as a
 * warning at runtime, not rejected at the type level.
 */
export function iconify(
  pack: string,
  options: IconifySourceOptions = {},
): IconSource {
  const { allowed: allowedList, transform } = options;
  const allowed = dedupeAllowed(
    pack,
    "iconify",
    allowedList,
    consoleLogger,
  );
  // Counts the `allowed: [...]` option's own length, not `allowed.size` - duplicates included,
  // since that's what "N icon(s) allowed" has always reported.
  const rejection = allowlistRejection(
    pack,
    allowedList?.length ?? 0,
    "the whole pack",
  );

  // The pack load starts here, at construction, against a `process.cwd()` guess - not lazily
  // inside getIcons/listIcons/checkPreconditions - so a missing pack fails as soon as the source
  // exists instead of only once the first icon is requested. `resolveRoot` (below) is the only
  // thing that can move `cwd` afterward: it restarts the load only when the loader's real project
  // root actually differs from the guess (e.g. `astro build --root <dir>` invoked from
  // elsewhere), so the common already-matching case pays nothing extra.
  let cwd = process.cwd();
  let packPromise = loadLocalPack(pack, cwd);
  packPromise.catch(() => {});

  /**
   * The loaded pack, with its catalog recorded for typegen along the way. Non-null: trusts
   * `checkPreconditions()` already confirmed the pack is installed (both bundled loaders call it
   * before anything else). Only unsound for a source used directly, outside either loader.
   */
  async function loadedPack(): Promise<IconifyJSON> {
    const data = (await packPromise)!;
    recordPackCatalog(pack, data, cwd);
    return data;
  }

  return {
    name: `iconify:${pack}`,
    resolveRoot(root: URL) {
      const resolved = stripTrailingSlash(fileURLToPath(root));
      if (resolved === cwd) return;
      cwd = resolved;
      packPromise = loadLocalPack(pack, cwd);
      packPromise.catch(() => {});
    },
    // The eager pack load's "fail loudly, up front" payoff: the one place "pack isn't installed"
    // is checked, called by both bundled loaders before listIcons/getIcons are ever touched, so a
    // missing pack is one clear failure instead of an `allowed` allowlist masking it in listIcons
    // and surfacing later as per-icon getIcons warnings.
    async checkPreconditions() {
      const data = await packPromise;
      if (!data) {
        throw new AstroIconError(
          `"${pack}" isn't installed locally.`,
          `Install it with \`npm install @iconify-json/${pack}\`, or use \`iconifyApi\` (see "astro-icon/collections") to resolve it from the public Iconify API instead. If you only need a few icons, restrict this source with an explicit \`allowed: [...]\` list instead of installing the whole pack.`,
        );
      }
    },
    getVersion() {
      return getPackVersion(pack, cwd);
    },
    async getIcons(names) {
      const { result, toFetch } = partitionAllowed(names, allowed, rejection);
      if (toFetch.length > 0) {
        // The whole pack is in memory either way, so there's nothing to narrow the load to.
        await addPackEntries(result, await loadedPack(), toFetch, pack, transform);
      }
      return result;
    },
    async listIcons() {
      // Not verified against the pack upfront - `checkPreconditions()` owns "is this source
      // usable at all" as its own concern, called by both bundled loaders before this.
      // `allowed` is a Set, so this also dedupes the option.
      if (allowed) return [...allowed];
      return localPackIconNames(await loadedPack());
    },
  };
}
