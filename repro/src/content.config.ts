import {
  defineIconCollection,
  iconify,
  localIcons,
} from "astro-icon/collections";

export const collections = {
  icons: defineIconCollection(localIcons()),
  mdi: defineIconCollection(iconify("mdi")),
};
