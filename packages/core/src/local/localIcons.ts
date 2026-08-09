import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Loader } from "astro/loaders";
import { AstroIconError } from "../core/AstroIconError.js";
import { iconEntrySchema } from "../core/iconEntrySchema.js";
import { listIconsOrFallback } from "../core/listIconsOrFallback.js";
import { recordCollection } from "../typegen.js";
import { localSource } from "./localSource.js";
import type { LocalSourceOptions } from "./localSource.js";

/**
 * A content layer loader for a directory of local `.svg` files. Each file's
 * path relative to `dir` (without its extension, subdirectories joined with
 * `/`) is its icon name - `<dir>/logos/deno.svg` is `"logos/deno"`.
 *
 * Watches the directory in dev the same way Astro's own built-in loaders
 * (`glob()`, `file()`) watch theirs: `add`/`change`/`unlink` update just the
 * one affected entry, not a full reload of every icon - add, edit, or
 * remove a `.svg` file and the collection picks it up with no dev server
 * restart, the same way Astro's built-in file-backed collections do.
 *
 * The suggested default for the `icons` collection:
 * ```ts
 * icons: defineCollection({ loader: localIcons() }),
 * ```
 */
export function localIcons(dir: string = "src/icons", options: LocalSourceOptions = {}): Loader {
  const strict = options.strict ?? false;

  return {
    name: "astro-icon/loaders/local",
    schema: iconEntrySchema,
    load: async (context) => {
      const { store, logger, parseData, generateDigest, config, watcher, collection } = context;

      const dirUrl = new URL(dir.replace(/\/?$/, "/"), config.root);
      const dirPath = fileURLToPath(dirUrl);
      const source = localSource(dirUrl, { ...options, logger });

      if (!existsSync(dirPath)) {
        logger.warn(
          `The local icon directory "${dirPath}" does not exist. Create it, or point "localIcons()" at a different "dir".`,
        );
      }

      function idFromPath(filePath: string): string | undefined {
        if (!filePath.startsWith(dirPath) || !filePath.endsWith(".svg")) return undefined;
        return filePath
          .slice(dirPath.length)
          .replace(/\\/g, "/")
          .replace(/^\//, "")
          .slice(0, -".svg".length);
      }

      async function syncIcon(id: string): Promise<void> {
        try {
          const data = await source.getIcon(id);
          const parsedData = await parseData({ id, data });
          store.set({ id, data: parsedData, digest: generateDigest(parsedData) });
        } catch (ex) {
          const detail = ex instanceof Error ? ex.message : String(ex);
          if (strict) {
            throw new AstroIconError(
              `Failed to build local icon "${id}": ${detail}`,
              `Fix the error above, or disable "strict" to skip this icon with a warning instead.`,
            );
          }
          logger.warn(`Failed to build local icon "${id}": ${detail}`);
        }
      }

      async function updateTypes(): Promise<void> {
        await recordCollection(config.root, "build", collection, [...store.keys()]);
      }

      // Full sync, same as any other loader's first run.
      const names = await listIconsOrFallback(source, {
        strict,
        logger,
        failureMessage: (detail) => `Failed to list local icons in "${dirPath}": ${detail}`,
        hint: `Fix the error above, or disable "strict" to skip local icons with a warning instead.`,
      });
      store.clear();
      for (const id of names) {
        await syncIcon(id);
      }
      await updateTypes();

      if (!watcher) return;

      watcher.add(dirPath);

      watcher.on("add", async (filePath: string) => {
        const id = idFromPath(filePath);
        if (!id) return;
        await syncIcon(id);
        await updateTypes();
        logger.info(`Added local icon "${id}"`);
      });

      watcher.on("change", async (filePath: string) => {
        const id = idFromPath(filePath);
        if (!id) return;
        await syncIcon(id);
        logger.info(`Reloaded local icon "${id}"`);
      });

      watcher.on("unlink", async (filePath: string) => {
        const id = idFromPath(filePath);
        if (!id) return;
        store.delete(id);
        await updateTypes();
        logger.info(`Removed local icon "${id}"`);
      });
    },
  };
}
