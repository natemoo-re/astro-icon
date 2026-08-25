import {
  defineIconCollection,
  iconify,
  localSvg,
} from "astro-icon/collections";

export const collections = {
  icons: defineIconCollection(localSvg()),
  mdi: defineIconCollection(iconify("mdi")),
};
