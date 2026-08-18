import { defineCollection } from "astro:content";
import { localIcons } from "astro-icon/loaders";

// The whole config. One collection, one loader, nothing to tune - the site
// builder persona never touches sprite/collection options.
export const collections = {
  icons: defineCollection({ loader: localIcons() }),
};
