import { defineLiveCollection } from "astro:content";
import { iconifyLive } from "astro-icon/loaders/live";

export const collections = {
  spinners: defineLiveCollection({ loader: iconifyLive("svg-spinners") }),
};
