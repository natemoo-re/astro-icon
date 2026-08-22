import { defineCollection } from "astro:content";
import { createIconLoader, localSource } from "astro-icon/loaders";

// The whole config. One collection, one source, nothing to tune - the site
// builder persona never touches loader options.
export const collections = {
  icons: defineCollection({ loader: createIconLoader(localSource()) }),
};
