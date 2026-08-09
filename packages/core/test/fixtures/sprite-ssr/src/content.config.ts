import { defineCollection } from "astro:content";
import { iconify } from "astro-icon/loaders";

export const collections = {
  icons: defineCollection({ loader: iconify("svg-spinners") }),
};
