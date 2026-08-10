import type { Loader, LoaderContext } from "astro/loaders";
import { AstroIconError } from "../core/AstroIconError.js";
import { iconEntrySchema } from "../core/iconEntrySchema.js";
import { listIconsOrFallback } from "../core/listIconsOrFallback.js";
import { mergeSources } from "../core/mergeSources.js";
import { resolveAllIcons } from "../core/resolveAllIcons.js";
import { recordCollection } from "../typegen.js";
import type { IconSource } from "../core/iconSource.js";

async function getSourceVersionKey(source: IconSource, names: string[]): Promise<string | undefined> {
  const version = await source.getVersion?.().catch(() => undefined);
  if (!version) return undefined;
  return `${version}::${names.slice().sort().join(",")}`;
}

export interface IconLoaderOptions {
  /**
   * When true, turns warnings (a source couldn't provide a requested icon,
   * or couldn't list its icons at all) into build errors.
   * @default false
   */
  strict?: boolean;
}

/**
 * A content layer loader around one or more `IconSource`s - the collection
 * always contains exactly what `listIcons()` reports (every icon the
 * source(s) allow), so loading and generated types are always the same set.
 * Restrict that set on a per-source basis (see `iconifySource`'s `icons`
 * option); this loader has no filtering of its own.
 *
 * Passing multiple sources combines them into one collection: each icon is
 * resolved by trying sources in order and using the first one that has it.
 *
 * Follows the Content Loader API's documented conventions: provides a
 * default Zod `schema` (still overridable via `defineCollection({ loader,
 * schema })`), and runs every entry through `parseData()` before storing it.
 */
export function createIconLoader(
  sources: IconSource | IconSource[],
  options: IconLoaderOptions = {},
): Loader {
  const source = mergeSources(sources);
  const { strict = false } = options;

  async function load(context: LoaderContext): Promise<void> {
    const { store, meta, logger, parseData, generateDigest, collection } = context;

    const names = await listIconsOrFallback(source, {
      strict,
      logger,
      failureMessage: (detail) => `"${source.name}" failed to list its icons: ${detail}`,
      hint: `Fix the error above, or disable "strict" to skip this source with a warning instead.`,
    });

    if (names.length === 0) {
      const message = `"${source.name}" has no icons to load for the "${collection}" collection.`;
      if (strict) {
        throw new AstroIconError(
          message,
          `Check that "${source.name}" is configured correctly and that its icon list (or \`icons: [...]\` option) isn't empty.`,
        );
      }
      logger.warn(message);
    }

    // If every merged source reports a version (e.g. an iconify pack's npm
    // version) and it - plus the exact requested icon set - matches what
    // was recorded last sync, the store (already warm, either from earlier
    // in this process or restored from a persisted content-layer cache)
    // already holds the correct result. Skip resolving anything.
    const metaKey = `astro-icon:version:${collection}`;
    const versionKey = await getSourceVersionKey(source, names);
    if (versionKey && versionKey === meta.get(metaKey) && names.every((name) => store.has(name))) {
      await recordCollection(context.config.root, "build", collection, names);
      return;
    }

    const resolved = await resolveAllIcons(source, names, (name, ex) => {
      const detail = ex instanceof Error ? ex.message : String(ex);
      if (strict) {
        throw new AstroIconError(
          `"${source.name}" failed to build "${name}": ${detail}`,
          `Fix the error above, or disable "strict" to skip this icon with a warning instead.`,
        );
      }
      logger.warn(`"${source.name}" failed to build "${name}": ${detail}`);
    });

    store.clear();
    for (const { id, data } of resolved) {
      const parsedData = await parseData({ id, data });
      store.set({ id, data: parsedData, digest: generateDigest(parsedData) });
    }

    if (versionKey) meta.set(metaKey, versionKey);
    else meta.delete(metaKey);

    // Keyed by the collection's own name (the key it's assigned under in
    // content.config.ts), not the source's name - those commonly differ
    // (e.g. `icons: defineCollection({ loader: iconify("mdi") })`), and
    // generated types need to match what `<Icon name="...">` is checked
    // against.
    //
    // Typed from `resolved` (what actually made it into the store), not
    // `names` (what listIcons() reported) - an icon that failed to build in
    // non-strict mode is warned-and-skipped from the store, and must not be
    // typed as a valid IconName either.
    await recordCollection(
      context.config.root,
      "build",
      collection,
      resolved.map(({ id }) => id),
    );
  }

  return { name: `astro-icon/loaders/icon/${source.name}`, load, schema: iconEntrySchema };
}
