import { readFileSync } from "node:fs";

import {
  createResolver,
  defineIntegration,
  addVitePlugin,
} from "astro-integration-kit";
import { z } from "astro/zod";

import { createVitePlugin } from "./vite-plugin-astro-icon.js";

export default defineIntegration({
  name: "astro-icon",
  optionsSchema: z
    .object({
      virtualModulePrefix: z.string().default("virtual:icons/"),
    })
    .optional(),
  setup({ options, name }) {
    const { resolve } = createResolver(import.meta.url);

    const normalizedVirtualModulePrefix =
      options?.virtualModulePrefix?.endsWith("/")
        ? options.virtualModulePrefix.endsWith("/")
          ? options.virtualModulePrefix
          : `${options.virtualModulePrefix}/`
        : "virtual:icons/";

    return {
      hooks: {
        "astro:config:setup": (params) => {
          addVitePlugin(params, {
            plugin: createVitePlugin(name, normalizedVirtualModulePrefix, {
              cacheDir: params.config.cacheDir,
              logger: params.logger,
              __DEV__: params.command === "dev",
            }),
          });
        },
        "astro:config:done": ({ injectTypes }) => {
          injectTypes({
            filename: "astro-icons.d.ts",
            content: readFileSync(
              resolve("../typings/virtual.d.ts"),
              "utf-8"
            ).replaceAll(
              "virtual:icons/*",
              `${normalizedVirtualModulePrefix}*`
            ),
          });
        },
      },
    };
  },
});
