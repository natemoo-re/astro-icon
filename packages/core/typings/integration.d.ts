import type { IconifyJSON, SVGOOptions } from "./iconify";

type IsUnique<T extends readonly string[]> =
  T extends readonly [infer First, ...infer Rest]
    ? First extends Rest[string]
      ? false
      : IsUnique<Rest>
    : true;

type ExtractDuplicates<T extends readonly string[]> =
  T extends readonly [infer First, ...infer Rest]
    ? First extends Rest[string]
      ? First | ExtractDuplicates<Rest>
      : ExtractDuplicates<Rest>
    : never;

type UniqueArrayError<T extends string> = [
  `Error: Duplicate value "${T}" found in array. Use unique values.`,
  ...T[]
];

type ValidateInclude<T extends Record<string, ["*"] | readonly string[]>> = {
  [K in keyof T]:
    T[K] extends ["*"]
      ? T[K]
      : T[K] extends readonly string[]
        ? IsUnique<T[K]> extends true
          ? T[K]
          : UniqueArrayError<ExtractDuplicates<T[K]>>
        : never;
};

export type IntegrationOptions<T extends Record<string, ["*"] | readonly string[]> = {}> = {
  include?: ValidateInclude<T>;
  /**
   * @default "src/icons"
   */
  iconDir?: string;
  /**
   * @default { plugins: ['preset-default'] }
   */
  svgoOptions?: SVGOOptions;
};

export type IconCollection = IconifyJSON;
export type AstroIconCollectionMap = Record<string, IconCollection>;
