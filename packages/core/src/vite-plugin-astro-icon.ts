import type { AstroConfig } from 'astro';
import { mkdir, stat, writeFile } from "node:fs/promises";
import type { IconCollection } from "virtual:astro-icon";
import type { Plugin } from 'vite';
import type { IntegrationOptions } from "./integration";
import { loadIconifyCollections, loadLocalCollection } from "./loaders";

export async function createPlugin({ include = {}, iconDir = 'src/icons' }: IntegrationOptions, { root }: Pick<AstroConfig, 'root'>): Promise<Plugin> {
  const virtualModuleId = "virtual:astro-icon";
  const resolvedVirtualModuleId = "\0" + virtualModuleId;

  // Load provided Iconify collections
  const collections = await loadIconifyCollections(include);

  return {
    name: "astro-icon",
    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
    },
    async load(id) {
      if (id === resolvedVirtualModuleId) {

        // Create local collection
        const local = await loadLocalCollection(iconDir)
        collections['local'] = local

        await generateIconTypeDefinitions(Object.values(collections), root);

        return `import.meta.glob('/src/icons/**/*.svg');

        export default ${JSON.stringify(collections)};\n
        export const config = ${JSON.stringify({ include })}`
      }
    },
  };
}

async function generateIconTypeDefinitions(collections: IconCollection[], rootDir: URL, defaultPack = 'local') {
  await ensureDir(new URL('./.astro', rootDir));
  await writeFile(new URL('./.astro/icon.d.ts', rootDir), `declare module 'astro-icon' {
    export type Icon = ${collections.length > 0 ? collections.map(collection => Object.keys(collection.icons).map(icon => `\n\t\t| "${collection.prefix === defaultPack ? '' : `${collection.prefix}:`}${icon}"`)).flat(1).join("") : 'never'};\n
  }`)
}

async function ensureDir(path: URL): Promise<void> {
  try {
    await stat(path)
  } catch (_) {
    await mkdir(path)
  }
}