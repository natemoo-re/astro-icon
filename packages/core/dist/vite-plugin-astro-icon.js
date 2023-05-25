import { mkdir, stat, writeFile } from "node:fs/promises";
import loadLocalCollection from "./loaders/loadLocalCollection";
import loadIconifyCollections from "./loaders/loadIconifyCollections";
export async function createPlugin({ include = {}, iconDir = 'src/icons', attribute }, { root }) {
    const virtualModuleId = "virtual:astro-icon";
    const resolvedVirtualModuleId = "\0" + virtualModuleId;
    // Load provided Iconify collections
    const collections = await loadIconifyCollections(include);
    await generateIconTypeDefinitions(Object.values(collections), root);
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
                try {
                    const local = await loadLocalCollection(iconDir);
                    // Only regenerate during load if we have local icons
                    if (Object.keys(local.icons).length > 0) {
                        collections['local'] = local;
                        await generateIconTypeDefinitions(Object.values(collections), root);
                    }
                }
                catch (ex) { }
                return `import.meta.glob('/src/icons/**/*.svg');

        export default ${JSON.stringify(collections)};\n
        export const config = ${JSON.stringify({ include, attribute })}`;
            }
        },
    };
}
async function generateIconTypeDefinitions(collections, rootDir, defaultPack = 'local') {
    await ensureDir(new URL('./.astro', rootDir));
    await writeFile(new URL('./.astro/icon.d.ts', rootDir), `declare module 'astro-icon/generated-types' {
    export type Icon = ${collections.length > 0 ? collections.map(collection => Object.keys(collection.icons).map(icon => `\n\t\t| "${collection.prefix === defaultPack ? '' : `${collection.prefix}:`}${icon}"`)).flat(1).join("") : 'never'};\n
  }`);
}
async function ensureDir(path) {
    try {
        await stat(path);
    }
    catch (_) {
        await mkdir(path);
    }
}
