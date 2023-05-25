declare module "virtual:astro-icon" {
  import type { IntegrationOptions, AstroIconCollectionMap } from './integrationOptions'
  
  const icons: AstroIconCollectionMap;
  export default icons;
  export const config: IntegrationOptions;
}
