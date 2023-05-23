

export type IntegrationOptions = {
  include?: Record<string, ['*'] | string[]>
  /**
   * @default "src/icons"
   */
  iconDir?: string
}