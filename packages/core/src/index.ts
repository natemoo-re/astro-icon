/**
 * astro-icon's vocabulary: every public type, plus {@link AstroIconError} - the one import
 * that's safe from any context (server, client, config, component). Runtime functionality lives
 * in the purpose-specific entries: `astro-icon/components` (rendering), `astro-icon/collections`
 * (config files), `astro-icon/source` (custom-source authoring), `astro-icon/optimize` (SVGO).
 */
export { AstroIconError } from "./internal/error.js";
export type {
  IconEntry,
  IconifySourceOptions,
  IconifyApiSourceOptions,
  OptimizeFn,
  TransformFn,
} from "../typings/types";
export type {
  IconName,
  LiveCollectionName,
  IconifyIconName,
} from "../typings/names";
export type {
  IconSource,
  IconSourceWatcher,
  IconChangeEvent,
} from "./content/source.js";
export type { CompositeSource } from "./content/compositeSource.js";
export type { LocalSvgOptions } from "./content/local/localSvg.js";
export type { IconLoaderOptions } from "./content/loader.js";
export type { LiveIconLoaderOptions } from "./content/liveLoader.js";
export type { IconCollectionConfig } from "./content/defineIconCollection.js";
export type { LiveIconCollectionConfig } from "./content/defineLiveIconCollections.js";
export type {
  EntryFacts,
  EntryFromSVGResult,
} from "./content/ingest/entryFromSVG.js";
export type { IconProps, LiveIconProps, SharedIconProps } from "./render/props.js";
