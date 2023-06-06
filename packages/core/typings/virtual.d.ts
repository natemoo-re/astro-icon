declare module "virtual:astro-icon" {
  import type { IntegrationOptions } from "../src/integration";
  import type { IconifyJSON } from "./iconify";

  export type IconCollection = IconifyJSON;
  export type AstroIconCollectionMap = Record<string, IconCollection>;

  const icons: AstroIconCollectionMap;
  export default icons;
  export const config: IntegrationOptions;
}
