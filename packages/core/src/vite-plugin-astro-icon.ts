import type { AstroConfig, AstroIntegrationLogger } from "astro";
import type { Plugin } from "vite";
import { makeSvgComponent } from "astro/assets/utils";
import { getIconData } from "./utils/icon.js";

interface PluginContext extends Pick<AstroConfig, "cacheDir"> {
  logger: AstroIntegrationLogger;
}

const DEFAULT_ICON_SIZE = 24;
const VIRTUAL_MODULE_ID = "astro:icons/";

export function createPlugin({ cacheDir }: PluginContext): Plugin {
  const resolvedVirtualModuleId = "\0" + VIRTUAL_MODULE_ID;

  return {
    name: "astro-icon",
    resolveId(id) {
      if (id.startsWith(VIRTUAL_MODULE_ID)) {
        return `\0${id}`;
      }
    },

    async load(id) {
      if (id.startsWith(resolvedVirtualModuleId)) {
        const name = id.slice(resolvedVirtualModuleId.length);
        const [collection, icon] = name.split("/");

        const data = await getIconData(collection, icon, { cacheDir });
        if (!data) return;

        const {
          width = DEFAULT_ICON_SIZE,
          height = DEFAULT_ICON_SIZE,
          body,
        } = data;
        const svg = `<svg data-icon="${collection}:${icon}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;

        return makeSvgComponent(
          { src: name, format: "svg", height, width },
          svg,
        );
      }
    },
    configureServer({ watcher, moduleGraph }) {
      watcher.add(`${iconDir}/**/*.svg`);
      watcher.on("change", async () => {
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
