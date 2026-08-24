export { AstroIconError } from "../internal/error.js";
export { iconifyLocalSource } from "./iconify/localSource.js";
export { iconifyApiSource } from "./iconify/apiSource.js";
export { localSource } from "./local/source.js";
export type { LocalSourceOptions } from "./local/source.js";
export { createIconLoader } from "./loader.js";
export type { IconLoaderOptions } from "./loader.js";
export { mergeSources } from "./compositeSource.js";
export type { CompositeSource } from "./compositeSource.js";
export type {
  IconSource,
  IconSourceWatcher,
  IconChangeEvent,
} from "./source.js";
export { entryFromSVG } from "./ingest/entryFromSVG.js";
export { entryFromIconifyData } from "./ingest/entryFromIconifyData.js";
export type { EntryFacts, EntryFromSVGResult } from "./ingest/entryFromSVG.js";
export type {
  IconifySourceOptions,
  IconifyApiSourceOptions,
  OptimizeFn,
  TransformFn,
  IconEntry,
} from "../../typings/types";
