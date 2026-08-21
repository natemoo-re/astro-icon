import type { Loader, LoaderContext } from "astro/loaders";
import { AstroIconError } from "../internal/error.js";
import { buildIcon, buildIcons } from "./buildIcons.js";
import { formatDuration } from "./duration.js";
import { iconEntrySchema } from "./entrySchema.js";
import { listIconsOrFallback } from "./listIconsOrFallback.js";
import { mergeSources } from "./compositeSource.js";
import { recordCollection } from "./typegen/index.js";
import type {
  IconChangeEvent,
  IconSource,
  IconSourceWatcher,
} from "./source.js";

function metaKeyFor(collection: string): string {
  return `astro-icon:version:${collection}`;
}

async function getSourceVersionKey(
  source: IconSource,
  names: string[],
): Promise<string | undefined> {
  const version = await source.getVersion?.().catch(() => undefined);
  if (!version) return undefined;
  return `${version}::${names.slice().sort().join(",")}`;
}

/**
 * The subset of Astro's `LoaderContext` this loader actually reads. Exported so a test fixture
 * only has to implement these methods, not Astro's full real interfaces for `store`, `meta`,
 * and `config`.
 */
export interface IconLoaderSyncContext {
  store: Pick<
    LoaderContext["store"],
    "clear" | "set" | "get" | "keys" | "has" | "delete"
  >;
  meta: Pick<LoaderContext["meta"], "get" | "set" | "delete" | "has">;
  logger: Pick<LoaderContext["logger"], "warn" | "info" | "error" | "debug">;
  parseData: LoaderContext["parseData"];
  generateDigest: LoaderContext["generateDigest"];
  collection: LoaderContext["collection"];
  config: Pick<LoaderContext["config"], "root">;
  watcher?: IconSourceWatcher;
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
 * The sync logic behind `createIconLoader`, taking only {@link IconLoaderSyncContext} instead of
 * Astro's full `LoaderContext` - keeping this signature (rather than `LoaderContext`) lets a test
 * fixture implement only the fields it actually needs, by calling the loader's own `.load()`.
 */
function syncIcons(
  source: IconSource,
  strict: boolean,
): (context: IconLoaderSyncContext) => Promise<void> {
  return async function load(context: IconLoaderSyncContext): Promise<void> {
    const {
      store,
      meta,
      logger,
      parseData,
      generateDigest,
      collection,
      watcher,
    } = context;

    // Turns one `report()`ed file-level change into a surgical store update - re-resolving just
    // that name for an "add"/"change", or deleting it for an "unlink" - instead of a full resync.
    // Never throws, even under `strict`: this runs from inside a watcher event handler, where an
    // unhandled rejection would be far worse than a logged warning.
    async function handleChange(event: IconChangeEvent): Promise<void> {
      try {
        if (event.type === "unlink") {
          store.delete(event.name);
          logger.info(`Removed icon "${event.name}" from "${collection}".`);
        } else {
          const { data } = await buildIcon(source, event.name);
          const parsedData = await parseData({ id: event.name, data });
          store.set({
            id: event.name,
            data: parsedData,
            digest: generateDigest(parsedData),
          });
          logger.info(
            `${event.type === "add" ? "Added" : "Reloaded"} icon "${event.name}" in "${collection}".`,
          );
        }
        meta.delete(metaKeyFor(collection));
        await recordCollection(context.config.root, "build", collection, [
          ...store.keys(),
        ]);
      } catch (ex) {
        const detail = ex instanceof Error ? ex.message : String(ex);
        logger.warn(
          `"${source.name}" failed to handle a "${event.type}" for "${event.name}": ${detail}`,
        );
      }
    }

    function registerWatch(): void {
      if (!watcher || !source.watch) return;
      source.watch(watcher, (event) => void handleChange(event));
    }

    // Before anything else: a source built eagerly (in `content.config.ts`, before Astro's
    // `config.root` exists) gets a chance to anchor itself now that a real one is available.
    source.resolveRoot?.(context.config.root);

    const syncStart = performance.now();

    const listStart = syncStart;
    const names = await listIconsOrFallback(source, {
      strict,
      logger,
      failureMessage: (detail) =>
        `"${source.name}" isn't usable for the "${collection}" collection: ${detail}`,
      hint: `Fix the error above, or disable "strict" to skip this source with a warning instead.`,
    });
    const listDuration = performance.now() - listStart;

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
    const metaKey = metaKeyFor(collection);
    const versionKey = await getSourceVersionKey(source, names);
    if (
      versionKey &&
      versionKey === meta.get(metaKey) &&
      names.every((name) => store.has(name))
    ) {
      await recordCollection(context.config.root, "build", collection, names);
      logger.debug(
        `"${collection}" is already up to date (${names.length} icon(s) from "${source.name}"), skipped in ${formatDuration(performance.now() - syncStart)}.`,
      );
      registerWatch();
      return;
    }

    const buildStart = performance.now();
    const built = await buildIcons(source, names, (name, ex) => {
      const detail = ex instanceof Error ? ex.message : String(ex);
      if (strict) {
        throw new AstroIconError(
          `"${source.name}" failed to build "${name}": ${detail}`,
          `Fix the error above, or disable "strict" to skip this icon with a warning instead.`,
        );
      }
      logger.warn(`"${source.name}" failed to build "${name}": ${detail}`);
    });
    const buildDuration = performance.now() - buildStart;

    store.clear();
    // `name` becomes the content-layer entry's `id` here - the one point where astro-icon's
    // own vocabulary (a source's icon name) crosses into Astro's content-layer vocabulary (id).
    for (const { name, data } of built) {
      const parsedData = await parseData({ id: name, data });
      store.set({
        id: name,
        data: parsedData,
        digest: generateDigest(parsedData),
      });
    }

    if (versionKey) meta.set(metaKey, versionKey);
    else meta.delete(metaKey);

    // Typed from `built`, not `names`: a failed icon is skipped from the store in non-strict mode.
    await recordCollection(
      context.config.root,
      "build",
      collection,
      built.map(({ name }) => name),
    );

    logger.info(
      `Loaded ${built.length} icon(s) for the "${collection}" collection in ${formatDuration(performance.now() - syncStart)}.`,
    );
    // "listing" (enumerating what's available) vs "building" (building each
    // icon, which for an iconify-backed source is where a slow Iconify API fallback or a
    // deferred local-pack load shows up) - debug-only detail for the total above.
    logger.debug(
      `"${collection}" breakdown: list ${formatDuration(listDuration)}, build ${formatDuration(buildDuration)}.`,
    );

    registerWatch();
  };
}

/**
 * Builds a build-time content layer loader around one or more
 * {@link IconSource}s. Use this to back a custom source, or to combine
 * several sources into one collection:
 *
 * ```ts
 * import { createIconLoader, iconifyLocalSource, localSource } from "astro-icon/loaders";
 *
 * export const collections = {
 *   icons: defineCollection({
 *     loader: createIconLoader([iconifyLocalSource("mdi"), localSource("src/icons")]),
 *   }),
 * };
 * ```
 *
 * Each icon is resolved by trying sources in order and using the first one
 * that has it. The collection always contains exactly what `listIcons()`
 * reports; restrict that on a per-source basis (see `iconifyLocalSource`'s
 * `allowed` option), since this loader does no filtering of its own.
 *
 * For a local-preferred, API-fallback Iconify source, compose
 * `iconifyLocalSource` and `iconifyApiSource` with `mergeSources` yourself:
 *
 * ```ts
 * import { createIconLoader, iconifyApiSource, iconifyLocalSource, mergeSources } from "astro-icon/loaders";
 *
 * export const collections = {
 *   mdi: defineCollection({
 *     loader: createIconLoader(
 *       mergeSources([
 *         iconifyLocalSource("mdi", { allowed: ["home"] }),
 *         iconifyApiSource("mdi", { allowed: ["home"] }),
 *       ]),
 *     ),
 *   }),
 * };
 * ```
 */
export function createIconLoader(
  sources: IconSource | IconSource[],
  options: IconLoaderOptions = {},
): Loader & { load: (context: IconLoaderSyncContext) => Promise<void> } {
  const source = mergeSources(sources);
  const { strict = false } = options;

  return {
    name: "astro-icon/loaders",
    load: syncIcons(source, strict),
    schema: iconEntrySchema,
  };
}
