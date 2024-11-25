import type { AstroIntegration } from "astro";
import { createPlugin } from "./vite-plugin-astro-icon.js";

export default function createIntegration(): AstroIntegration {
  return {
    name: "astro-icon",
    hooks: {
      "astro:config:setup"({ updateConfig, command, config, logger }) {
        updateConfig({
          experimental: {
            svg: config.experimental?.svg ?? { mode: "inline" },
          },
          vite: {
            plugins: [
              createPlugin({
                cacheDir: config.cacheDir,
                logger,
                experimental: config.experimental,
                __DEV__: command === "dev",
              }),
            ],
          },
        });
      },
    },
  };
}
