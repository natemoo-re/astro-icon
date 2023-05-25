import type { AstroIntegration } from 'astro'
import type { SVGOOptions } from '../typings/iconify.js';
import { createPlugin } from "./vite-plugin-astro-icon.js";

export type IntegrationOptions = {
  include?: Record<string, ['*'] | string[]>
  /**
   * @default "src/icons"
   */
  iconDir?: string
  /**
   * @default 'astro-icon'
   */
  attribute?: string
  /**
   * @default { plugins: ['preset-default'] }
   */
  svgoOptions?: SVGOOptions
};

export default function createIntegration(opts: IntegrationOptions = {}): AstroIntegration {
  return {
    name: "astro-icon",
    hooks: {
      async "astro:config:setup"({ updateConfig, config }) {
        updateConfig({
          vite: {
            plugins: [await createPlugin(opts, { root: config.root })],
          },
        });
      },
    },
  };
}

