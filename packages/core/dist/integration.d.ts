import type { AstroIntegration } from 'astro';
import type { SVGOOptions } from '../typings/iconify.js';
export type IntegrationOptions = {
    include?: Record<string, ['*'] | string[]>;
    /**
     * @default "src/icons"
     */
    iconDir?: string;
    /**
     * @default 'astro-icon'
     */
    attribute?: string;
    /**
     * @default { plugins: ['preset-default'] }
     */
    svgoOptions?: SVGOOptions;
};
export default function createIntegration(opts?: IntegrationOptions): AstroIntegration;
