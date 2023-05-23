import type { IconifyJSON } from "./iconify";

export type IntegrationOptions = {
  include?: Record<string, ['*'] | string[]>
  /**
   * @default "src/icons"
   */
  iconDir?: string
};


export type IconCollection = IconifyJSON;
export type AstroIconCollectionMap = Record<string, IconCollection>;