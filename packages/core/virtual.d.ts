declare module "virtual:astro-icon" {
  export type AstroIconCollection = Record<string, import("@iconify/types").IconifyJSON>;
  export type AstroIconOptions = import("./integration").AstroIconOptions

  const icons: AstroIconCollection;
  export default icons;
  export const config: AstroIconOptions;
}