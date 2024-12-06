import type { AstroConfig, AstroIntegrationLogger } from "astro";
import type { Plugin } from "vite";
import { makeSvgComponent } from "astro/assets/utils";
import { getIconData } from "./utils/icon.js";
import { FileCache } from "./utils/cache.js";
import { AstroIconError } from "./utils/error.js";

interface PluginOptions extends Pick<AstroConfig, "cacheDir" | "experimental"> {
  logger: AstroIntegrationLogger;
  __DEV__: boolean;
}

const DEFAULT_ICON_SIZE = 24;
const VIRTUAL_MODULE_ID = "astro:icons/";
const RESOLVED_VIRTUAL_MODULE_ID = "\0" + VIRTUAL_MODULE_ID;

export function createPlugin({
  cacheDir,
  logger,
  experimental,
  __DEV__,
}: PluginOptions): Plugin {
  const cache = new FileCache(new URL("astro-icon/icons/", cacheDir), logger);

  return {
    name: "astro-icon",
    resolveId(id) {
      if (id.startsWith(VIRTUAL_MODULE_ID)) {
        return `\0${id}`;
      }
    },
    async load(id) {
      if (id.startsWith(RESOLVED_VIRTUAL_MODULE_ID)) {
        const name = id.slice(RESOLVED_VIRTUAL_MODULE_ID.length);
        const [collection, icon] = name.split("/");

        try {
          const data = await getIconData(collection, icon, {
            cache,
            logger,
            __DEV__,
          });
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
            experimental.svg,
          );
        } catch (e) {
          if (e instanceof AstroIconError) {
            throw e;
          } else if (e instanceof Error) {
            logger.error(e.message);
            return;
          } else {
            throw e;
          }
        }
      }
    },
  };
}
