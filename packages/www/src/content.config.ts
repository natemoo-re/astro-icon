import { defineCollection } from "astro:content";
import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";
import {
  createIconLoader,
  iconifyLocalSource,
  localSource,
} from "astro-icon/loaders";

// This site documents astro-icon, and renders every icon on it with astro-icon.
// Each collection below is the exact pattern its own guide describes.
export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
  icons: defineCollection({ loader: createIconLoader(localSource()) }),
  mdi: defineCollection({
    loader: createIconLoader(iconifyLocalSource("mdi")),
  }),
  ri: defineCollection({ loader: createIconLoader(iconifyLocalSource("ri")) }),
};
