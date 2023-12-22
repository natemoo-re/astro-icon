import type { IntegrationOptions } from "../typings/integration";
import { createPlugin } from "./vite-plugin-astro-icon.js";
import type { AstroIntegration } from "astro";

export default function createIntegration(
  opts: IntegrationOptions = {}
): AstroIntegration {
  return {
    name: "astro-icon",
    hooks: {
      "astro:config:setup"({ updateConfig, config, logger }) {
        const external =
          config.output === "static" ? ["@iconify-json/*"] : undefined;
        const { root, output } = config;
        updateConfig({
          vite: {
            plugins: [createPlugin(opts, { root, output, logger })],
            ssr: {
              external,
            },
          },
        });
      },
    },
  };
}
