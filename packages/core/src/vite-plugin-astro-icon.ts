import type { AstroConfig, AstroIntegrationLogger } from "astro";
import { createHash } from "node:crypto";
import { parse, resolve } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { Plugin } from "vite";
import type {
  AstroIconCollectionMap,
  IconCollection,
  IntegrationOptions,
} from "../typings/integration";
import loadLocalCollection from "./loaders/loadLocalCollection.js";
import loadIconifyCollections from "./loaders/loadIconifyCollections.js";

interface PluginContext extends Pick<AstroConfig, "root" | "output"> {
  logger: AstroIntegrationLogger;
}

export function createPlugin(
  { include = {}, iconDir = "src/icons", svgoOptions }: IntegrationOptions,
  ctx: PluginContext,
): Plugin {
  let collections: AstroIconCollectionMap | undefined;
  const { root } = ctx;
  const virtualModuleId = "virtual:astro-icon";
  const resolvedVirtualModuleId = "\0" + virtualModuleId;

  return {
    name: "astro-icon",
    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
    },

    async load(id) {
      if (id === resolvedVirtualModuleId) {
        try {
          if (!collections) {
            collections = await loadIconifyCollections({ root, include });
          }
          const local = await loadLocalCollection(iconDir, svgoOptions);
          collections["local"] = local;
          logCollections(collections, { ...ctx, iconDir });
          await generateIconTypeDefinitions(Object.values(collections), root);
        } catch (ex) {
          // Failed to load the local collection
        }
        return `export default ${JSON.stringify(collections)};\nexport const config = ${JSON.stringify({ include })}`;
      }
    },
    configureServer({ watcher, moduleGraph }) {
      watcher.add(`${iconDir}/**/*.svg`);
      watcher.on("all", async (_, filepath: string) => {
        const parsedPath = parse(filepath);
        const resolvedIconDir = resolve(root.pathname, iconDir);
        const isSvgFileInIconDir =
          parsedPath.dir.startsWith(resolvedIconDir) &&
          parsedPath.ext === ".svg";
        const isAstroConfig = parsedPath.name === "astro.config";
        if (!isSvgFileInIconDir && !isAstroConfig) return;
        console.log(`Local icons changed, reloading`);
        try {
          if (!collections) {
            collections = await loadIconifyCollections({ root, include });
          }
          const local = await loadLocalCollection(iconDir, svgoOptions);
          collections["local"] = local;
          logCollections(collections, { ...ctx, iconDir });
          await generateIconTypeDefinitions(Object.values(collections), root);
          moduleGraph.invalidateAll();
        } catch (ex) {
          // Failed to load the local collection
        }
        return `export default ${JSON.stringify(collections)};\nexport const config = ${JSON.stringify({ include })}`;
      });
    },
  };
}

function logCollections(
  collections: AstroIconCollectionMap,
  { logger, iconDir }: PluginContext & { iconDir: string },
) {
  if (Object.keys(collections).length === 0) {
    logger.warn("No icons detected!");
    return;
  }
  const names: string[] = Object.keys(collections).filter((v) => v !== "local");
  if (collections["local"]) {
    names.unshift(iconDir);
  }
  logger.info(`Loaded icons from ${names.join(", ")}`);
}

async function generateIconTypeDefinitions(
  collections: IconCollection[],
  rootDir: URL,
  defaultPack = "local",
): Promise<void> {
  const typeFile = new URL("./.astro/icon.d.ts", rootDir);
  await ensureDir(new URL("./", typeFile));
  const oldHash = await tryGetHash(typeFile);
  const currentHash = collectionsHash(collections);
  if (currentHash === oldHash) {
    return;
  }
  await writeFile(
    typeFile,
    `// Automatically generated by astro-icon
// ${currentHash}

declare module 'virtual:astro-icon' {
\texport type Icon = ${
      collections.length > 0
        ? collections
            .map((collection) =>
              Object.keys(collection.icons)
                .concat(Object.keys(collection.aliases ?? {}))
                .map(
                  (icon) =>
                    `\n\t\t| "${
                      collection.prefix === defaultPack
                        ? ""
                        : `${collection.prefix}:`
                    }${icon}"`,
                ),
            )
            .flat(1)
            .join("")
        : "never"
    };
}`,
  );
}

function collectionsHash(collections: IconCollection[]): string {
  const hash = createHash("sha256");
  for (const collection of collections) {
    hash.update(collection.prefix);
    hash.update(
      Object.keys(collection.icons)
        .concat(Object.keys(collection.aliases ?? {}))
        .sort()
        .join(","),
    );
  }
  return hash.digest("hex");
}

async function tryGetHash(path: URL): Promise<string | void> {
  try {
    const text = await readFile(path, { encoding: "utf-8" });
    return text.split("\n", 3)[1].replace("// ", "");
  } catch {}
}

async function ensureDir(path: URL): Promise<void> {
  try {
    await mkdir(path, { recursive: true });
  } catch {}
}
