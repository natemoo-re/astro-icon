import type { AstroIntegration } from "astro";
import { createPlugin } from "./vite-plugin-astro-icon.js";

export type IntegrationOptions = {
  include?: Record<string, ["*"] | string[]>;
  /**
   * @default "src/icons"
   */
  iconDir?: string;
};

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
