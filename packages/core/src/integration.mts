import { writeFile } from "node:fs/promises";
import createLocalCollection from './createLocalCollection.js'
import loadIconifyCollections from './loadIconifyCollections.mjs'
import type { AstroConfig, AstroIntegration } from 'astro'
import type { Plugin } from 'vite'
import type { IconifyJSON } from "@iconify/types";
import type { IntegrationOptions } from "./types.d.mts";

export default function createIntegration(opts: IntegrationOptions = {}): AstroIntegration {
  return {
    name: "astro-icon",
    hooks: {
      async "astro:config:setup"({ updateConfig, command, config }) {
        updateConfig({
          vite: {
            plugins: [await getVitePlugin(opts, { root: config.root })],
          },
        });
      },
    },
  };
}

async function getVitePlugin({ include = {}, iconDir = 'src/icons', svgoOptions }: IntegrationOptions, { root }: Pick<AstroConfig, 'root'>): Promise<Plugin> {
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
        const local = await createLocalCollection(iconDir, svgoOptions)
        collections['local'] = local

        await generateIconTypeDefinitions(Object.values(collections), root);

        return `import.meta.glob('/src/icons/**/*.svg');

        export default ${JSON.stringify(collections)};\n
        export const config = ${JSON.stringify({ include })}`
      }
    },
  };
}

async function generateIconTypeDefinitions(collections: IconifyJSON[], rootDir: URL, defaultPack = 'local') {
  await writeFile(new URL('./.astro/icon.d.ts', rootDir), `declare module 'astro-icon' {
    type Icon = ${collections.length > 0 ? collections.map(collection => Object.keys(collection.icons).map(icon => `\n\t\t| "${collection.prefix === defaultPack ? '' : `${collection.prefix}:`}${icon}"`)).flat(1).join("") : 'never'};
  }`)
}
