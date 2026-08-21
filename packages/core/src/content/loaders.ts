export { AstroIconError } from "../internal/error.js";
export { iconifyLocalSource, iconifyApiSource } from "./iconify/source.js";
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
export { parseIconSVG } from "./parseIconSVG.js";
export type { ParseIconSVGOptions } from "./parseIconSVG.js";
export type {
  IconifySourceOptions,
  OptimizeFn,
  IconEntry,
} from "../../typings/types";
