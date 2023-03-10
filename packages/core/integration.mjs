import { getIcons } from "@iconify/utils";
import { loadCollectionFromFS } from "@iconify/utils/lib/loader/fs";
import { loadLocalCollection } from "./lib/load.mjs";
import { writeFile } from "node:fs/promises";

/** @returns {import('astro').AstroIntegration} */
export default function icon(opts = {}) {
  return {
    name: "astro-icon",
    hooks: {
      async "astro:config:setup"({ updateConfig, command, config }) {
        updateConfig({
          vite: {
            plugins: [await getVitePlugin(opts, { command, output: config.output, root: config.root })],
          },
        });
      },
    },
  };
}

/** @returns {import('vite').Plugin} */
async function getVitePlugin({ include = {} }, { command, root }) {
  const virtualModuleId = "virtual:astro-icon";
  const resolvedVirtualModuleId = "\0" + virtualModuleId;

  // let collections = [];
  // const possibleCollections = Object.keys(await lookupCollections());
  // const invalidCollections = Object.keys(include).filter(name => !possibleCollections.includes(name));
  // for (const invalidCollection of invalidCollections) {
  //   console.error(`[astro-icon] "${invalidCollection}" does not appear to be a valid iconify collection!`);
  // }
  const fullCollections = await Promise.all(
    Object.keys(include).map((collection) =>
      loadCollectionFromFS(collection).then((value) => [collection, value])
    )
  );

  /** @type {import("./integration").AstroIconCollection} */
  const collections = {}
  for (const [name, collection] of fullCollections) {
    const reduced = include[name];
    // include all icons in the collection
    if (reduced.length === 1 && reduced[0] === '*' && collection) {
      collections[name] = collection;
    }
    const reducedCollection = getIcons(collection, reduced)
    if (reducedCollection) {
      collections[name] = reducedCollection;
    }
  }

  return {
    name: "astro-icon",
    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
    },
    async load(id) {
      if (id === resolvedVirtualModuleId) {
        const local = await loadLocalCollection()
        collections["local"] = local.export()
        await writeFile(new URL('./.astro/icon.d.ts', root), `declare module 'astro-icon' {
          type Icon = ${Object.values(collections).map(collection => Object.keys(collection.icons).map(icon => `\n\t\t| "${collection.prefix === 'local' ? '' : `${collection.prefix}:`}${icon}"`)).flat(1).join("")};
        }`)

        return `import.meta.glob('/src/icons/**/*.svg');

        export default ${JSON.stringify(
          collections
        )};\nexport const config = ${command === "dev" ? JSON.stringify({ include }) : "undefined"
          }`;
      }
    },
  };
}

