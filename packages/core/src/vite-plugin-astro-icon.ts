import type { AstroConfig } from "astro";
import { mkdir, stat, writeFile } from "node:fs/promises";
import type { Plugin } from "vite";
import type {
  IconCollection,
  IntegrationOptions,
} from "../typings/integration";
import loadLocalCollection from "./loaders/loadLocalCollection.js";
import loadIconifyCollections from "./loaders/loadIconifyCollections.js";

export async function createPlugin(
  { include = {}, iconDir = "src/icons" }: IntegrationOptions,
  { root }: Pick<AstroConfig, "root">
): Promise<Plugin> {
  const virtualModuleId = "virtual:astro-icon";
  const resolvedVirtualModuleId = "\0" + virtualModuleId;

  // Load collections
  const collections = await loadCollections({ include, iconDir }, { root });

  return {
    name: "astro-icon",
    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
    },
    async load(id) {
      if (id === resolvedVirtualModuleId) {
        return `export default ${JSON.stringify(
          collections
        )};\nexport const config = ${JSON.stringify({ include })}`;
      }
    },
  };
}

async function loadCollections(
  {
    include,
    iconDir,
  }: Required<Pick<IntegrationOptions, "include" | "iconDir">>,
  { root }: Pick<AstroConfig, "root">
) {
  const collections = await loadIconifyCollections(include);

  try {
    // Attempt to create local collection
    const local = await loadLocalCollection(iconDir);
    collections["local"] = local;
  } catch (ex) {
    // Failed to load the local collection
  }

  await generateIconTypeDefinitions(Object.values(collections), root);

  return collections;
}

async function generateIconTypeDefinitions(
  collections: IconCollection[],
  rootDir: URL,
  defaultPack = "local"
): Promise<void> {
  await ensureDir(new URL("./.astro", rootDir));
  await writeFile(
    new URL("./.astro/icon.d.ts", rootDir),
    `declare module 'astro-icon' {
    export type Icon = ${
      collections.length > 0
        ? collections
            .map((collection) =>
              Object.keys(collection.icons).map(
                (icon) =>
                  `\n\t\t| "${
                    collection.prefix === defaultPack
                      ? ""
                      : `${collection.prefix}:`
                  }${icon}"`
              )
            )
            .flat(1)
            .join("")
        : "never"
    };
  }`
  );
}

async function ensureDir(path: URL): Promise<void> {
  try {
    await stat(path);
  } catch (_) {
    await mkdir(path);
  }
}
