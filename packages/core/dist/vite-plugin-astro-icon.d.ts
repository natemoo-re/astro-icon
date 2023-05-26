import type { AstroConfig } from 'astro';
import type { Plugin } from 'vite';
import type { IntegrationOptions } from "./integration.js";
export declare function createPlugin({ include, iconDir, attribute }: IntegrationOptions, { root }: Pick<AstroConfig, 'root'>): Promise<Plugin>;
