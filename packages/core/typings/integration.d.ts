
import type { IconifyJSON, SVGOOptions } from './iconify'

export type IconCollection = IconifyJSON;
export type AstroIconCollectionMap = Record<string, IconCollection>


export type IntegrationOptions = {
  include?: Record<string, ['*'] | string[]>
  /**
   * @default "src/icons"
   */
  iconDir?: string
  /**
   * @default 'astro-icon'
   */
  attribute?: string
  /**
   * @default { plugins: ['preset-default'] }
   */
  svgoOptions?: SVGOOptions
};