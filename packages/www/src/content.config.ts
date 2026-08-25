import { defineCollection } from "astro:content";
import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";
import {
  defineIconCollection,
  iconify,
  localIcons,
} from "astro-icon/collections";

// This site documents astro-icon, and renders every icon on it with astro-icon.
// Each collection below is the exact pattern its own guide describes.
export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
  icons: defineIconCollection(localIcons()),
  mdi: defineIconCollection(iconify("mdi")),
};
