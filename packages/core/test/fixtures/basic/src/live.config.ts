import { defineLiveCollection } from "astro:content";
import { iconifyLive } from "astro-icon/loaders/live";

export const collections = {
  liveSpinners: defineLiveCollection({ loader: iconifyLive("svg-spinners") }),
};
