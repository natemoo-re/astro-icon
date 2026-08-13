import { defineCollection } from "astro:content";
import { iconifyLocalSource, createIconLoader } from "astro-icon/loaders";

export const collections = {
  icons: defineCollection({ loader: createIconLoader(iconifyLocalSource("svg-spinners")) }),
};
