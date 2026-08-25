/**
 * The custom-source authoring kit: everything needed to implement an {@link IconSource} of your
 * own and feed it to `astro-icon/collections`' `defineIconCollection`/`defineLiveIconCollections`.
 *
 * `defineIconSource` types the source; `entryFromSVG` (raw SVG text) and `entryFromIconifyData`
 * (structured Iconify data) build canonical entries; `mergeSources` pre-composes several sources
 * into one first-match-wins `IconSource` (e.g. for a library exporting a single source object -
 * config files never need it, since every collection-building call accepts an array directly).
 */
export { defineIconSource } from "./content/defineIconSource.js";
export { entryFromSVG } from "./content/ingest/entryFromSVG.js";
export type {
  EntryFacts,
  EntryFromSVGResult,
} from "./content/ingest/entryFromSVG.js";
export { entryFromIconifyData } from "./content/ingest/entryFromIconifyData.js";
export { mergeSources } from "./content/compositeSource.js";
export type { CompositeSource } from "./content/compositeSource.js";
export { AstroIconError } from "./internal/error.js";
export type {
  IconSource,
  IconSourceWatcher,
  IconChangeEvent,
} from "./content/source.js";
export type { IconEntry, OptimizeFn, TransformFn } from "../typings/types";
