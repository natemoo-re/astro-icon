import type { AstroConfig } from "astro";
import type { Plugin } from "vite";
import type { IntegrationOptions } from "../typings/integration";
export declare function createPlugin({ include, iconDir }: IntegrationOptions, { root }: Pick<AstroConfig, "root">): Promise<Plugin>;
