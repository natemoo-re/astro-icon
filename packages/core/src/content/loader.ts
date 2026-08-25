import type { Loader, LoaderContext } from "astro/loaders";
import { AstroIconError } from "../internal/error.js";
import { iconEntrySchema } from "../internal/entryContract.js";
import { buildIcon, buildIcons } from "./buildIcons.js";
import { formatDuration } from "./duration.js";
import { mergeSources } from "./compositeSource.js";
import { recordCollection as defaultRecordCollection } from "./typegen/index.js";
import type { TypegenRecorder } from "./typegen/index.js";
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
  /** Substitutes the typegen recorder used for this sync; primarily for tests that want an in-memory recorder instead of mocking the whole typegen module. Defaults to the shared process-wide instance. */
  typegen?: Pick<TypegenRecorder, "recordCollection">;
}

export interface IconLoaderOptions {}

/**
 * The sync logic behind `createIconLoader`, taking only {@link IconLoaderSyncContext} instead of
 * Astro's full `LoaderContext` - keeping this signature (rather than `LoaderContext`) lets a test
 * fixture implement only the fields it actually needs, by calling the loader's own `.load()`.
 */
function syncIcons(
  source: IconSource,
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
    const recordCollection =
      context.typegen?.recordCollection ?? defaultRecordCollection;

    // A watcher on the context means this sync is running under `astro dev`: a hard failure there
    // (a source that can't be used at all, an icon that fails to build) warns and continues,
    // since a broken icon shouldn't take down the whole dev server and `<Icon>` already surfaces
    // a per-render overlay error for one that's actually missing at render time. Without a
    // watcher (`astro build`/`astro sync`), the same failure fails the build instead - there's no
    // later render pass to catch it, and a content collection that silently dropped icons is
    // worse than a build that says so.
    const dev = !!watcher;

    // Turns one `report()`ed file-level change into a surgical store update - re-resolving just
    // that name for an "add"/"change", or deleting it for an "unlink" - instead of a full resync.
    // Never throws, even in a build: this runs from inside a watcher event handler (dev-only to
    // begin with), where an unhandled rejection would be far worse than a logged warning.
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

    // `checkPreconditions()` first - is this source usable at all, as a distinct concern from
    // what `listIcons()` reports (see `IconSource.checkPreconditions`'s doc comment). Either
    // failing falls back to an empty list with a warning in dev, or fails the build.
    const listStart = syncStart;
    let names: string[] = [];
    try {
      await source.checkPreconditions?.();
      names = source.listIcons ? await source.listIcons() : [];
    } catch (ex) {
      const detail = ex instanceof Error ? ex.message : String(ex);
      const message = `"${source.name}" isn't usable for the "${collection}" collection: ${detail}`;
      if (!dev) {
        throw new AstroIconError(
          message,
          `Fix the error above. This is a build error rather than a warning because there's no dev server watching to recover from it once the collection is empty.`,
        );
      }
      logger.warn(message);
    }
    const listDuration = performance.now() - listStart;

    if (names.length === 0) {
      const message = `"${source.name}" has no icons to load for the "${collection}" collection.`;
      if (!dev) {
        throw new AstroIconError(
          message,
          `Check that "${source.name}" is configured correctly and that its icon list (or \`allowed: [...]\` option) isn't empty.`,
        );
      }
      logger.warn(message);
    }

    // Skip resolving if every source's version + the requested icon set matches the last sync
    // and every requested name is still in the store. No `versionKey` means no reliable
    // freshness signal, so never skip.
    const metaKey = metaKeyFor(collection);
    const versionKey = await getSourceVersionKey(source, names);
    const upToDate =
      !!versionKey &&
      versionKey === meta.get(metaKey) &&
      names.every((name) => store.has(name));
    if (upToDate) {
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
      if (!dev) {
        throw new AstroIconError(
          `"${source.name}" failed to build "${name}": ${detail}`,
          `Fix the error above. This is a build error rather than a warning because there's no dev server watching to recover from it once the icon is missing from the collection.`,
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

    // Record this sync's version key for the next up-to-date check - or clear a stale one, so
    // a source that stopped reporting a version always rebuilds.
    if (versionKey) meta.set(metaKey, versionKey);
    else meta.delete(metaKey);

    // Typed from `built`, not `names`: a failed icon is skipped from the store in dev, where a
    // build failure above would have already stopped the sync entirely.
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
 * {@link IconSource}s - the layer under `defineIconCollection`, exposed for
 * callers who need Astro's `defineCollection` directly (e.g. to attach
 * their own `schema`):
 *
 * ```ts
 * import { defineCollection } from "astro:content";
 * import { createIconLoader, iconify, localSvg } from "astro-icon/collections";
 *
 * export const collections = {
 *   icons: defineCollection({
 *     loader: createIconLoader([iconify("mdi"), localSvg("src/icons")]),
 *     schema: mySchema,
 *   }),
 * };
 * ```
 *
 * Each icon is resolved by trying sources in order and using the first one
 * that has it. The collection always contains exactly what `listIcons()`
 * reports; restrict that on a per-source basis (see `iconify`'s
 * `allowed` option), since this loader does no filtering of its own.
 */
export function createIconLoader(
  sources: IconSource | IconSource[],
  options: IconLoaderOptions = {},
): Loader & { load: (context: IconLoaderSyncContext) => Promise<void> } {
  const source = mergeSources(sources);
  // `options` is unused today - reserved for future loader-level options now that `strict` is
  // gone. Failure handling is derived from the sync context itself (`context.watcher`, i.e. dev
  // vs. build) rather than configured.

  return {
    name: "astro-icon/collections",
    load: syncIcons(source),
    schema: iconEntrySchema,
  };
}
