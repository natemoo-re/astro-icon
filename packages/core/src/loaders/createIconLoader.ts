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
 * Builds a build-time content layer loader around one or more
 * {@link IconSource}s. Use this to back a custom source, or to combine
 * several sources into one collection:
 *
 * ```ts
 * import { createIconLoader, iconifySource, localSource } from "astro-icon/loaders";
 *
 * export const collections = {
 *   icons: defineCollection({
 *     loader: createIconLoader([iconifySource("mdi"), localSource("src/icons")]),
 *   }),
 * };
 * ```
 *
 * Each icon is resolved by trying sources in order and using the first one
 * that has it. The collection always contains exactly what `listIcons()`
 * reports; restrict that on a per-source basis (see `iconifySource`'s
 * `icons` option), since this loader does no filtering of its own.
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

    // Skip resolving if every source's version + the requested icon set matches the last sync.
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

    // Typed from `resolved`, not `names`: a failed icon is skipped from the store in non-strict mode.
    await recordCollection(
      context.config.root,
      "build",
      collection,
      resolved.map(({ id }) => id),
    );
  }

  return { name: `astro-icon/loaders/icon/${source.name}`, load, schema: iconEntrySchema };
}
