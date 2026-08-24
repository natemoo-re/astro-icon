import { defineCollection } from "astro:content";
import {
  createIconLoader,
  iconifyLocalSource,
  localSource,
} from "astro-icon/loaders";

export const collections = {
  icons: defineCollection({ loader: createIconLoader(localSource()) }),
  mdi: defineCollection({
    loader: createIconLoader(iconifyLocalSource("mdi")),
  }),
};
