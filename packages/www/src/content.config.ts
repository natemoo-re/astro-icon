import { defineCollection } from "astro:content";
import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";
import { defineIconCollection, iconify, localSvg } from "astro-icon/collections";

// This site documents astro-icon, and renders every icon on it with astro-icon.
// Each collection below is the exact pattern its own guide describes.
export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
  icons: defineIconCollection(localSvg()),
  mdi: defineIconCollection(iconify("mdi")),
};
