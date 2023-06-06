import type { IconifyJSON } from "@iconify/types";
import type { IntegrationOptions } from "./types.mjs";

declare module "virtual:astro-icon" {
  export type AstroIconCollection = Record<string, IconifyJSON>;
  export type AstroIconOptions = IntegrationOptions;

  const icons: AstroIconCollection;
  export default icons;
  export const config: AstroIconOptions;
}
