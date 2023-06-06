import type { AstroIntegration } from "astro";
import type { IntegrationOptions } from '../typings/integration';
import { createPlugin } from "./vite-plugin-astro-icon.js";

export default function createIntegration(
  opts: IntegrationOptions = {}
): AstroIntegration {
  return {
    name: "astro-icon",
    hooks: {
      async "astro:config:setup"({ updateConfig, command, config }) {
        updateConfig({
          vite: {
            plugins: [await createPlugin(opts, { root: config.root })],
          },
        });
      },
    },
  };
}
