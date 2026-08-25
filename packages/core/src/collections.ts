/**
 * Everything that goes in a config file - `content.config.ts` or `live.config.ts`.
 *
 * `defineIconCollection`/`defineLiveIconCollections` build the collections; `iconify`/`iconifyApi`/
 * `localSvg` are the bundled sources that feed them; `createIconLoader`/`createLiveIconLoader`
 * are the drop-down-a-layer escape hatches for `defineCollection({ loader, schema })`/
 * `defineLiveCollection()`. Authoring a *custom* source lives in `astro-icon/source` instead.
 */
export { defineIconCollection } from "./content/defineIconCollection.js";
export type { IconCollectionConfig } from "./content/defineIconCollection.js";
export { defineLiveIconCollections } from "./content/defineLiveIconCollections.js";
export type { LiveIconCollectionConfig } from "./content/defineLiveIconCollections.js";
export { createIconLoader } from "./content/loader.js";
export type { IconLoaderOptions } from "./content/loader.js";
export { createLiveIconLoader } from "./content/liveLoader.js";
export type { LiveIconLoaderOptions } from "./content/liveLoader.js";
export { iconify } from "./content/iconify/iconify.js";
export { iconifyApi } from "./content/iconify/iconifyApi.js";
export { localSvg } from "./content/local/localSvg.js";
export type { LocalSvgOptions } from "./content/local/localSvg.js";
export { AstroIconError } from "./internal/error.js";
export type { IconSource } from "./content/source.js";
export type {
  IconEntry,
  IconifySourceOptions,
  IconifyApiSourceOptions,
  OptimizeFn,
  TransformFn,
} from "../typings/types";
