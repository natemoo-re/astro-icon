import { defineLiveCollection } from "astro:content";
import {
  createLiveIconLoader,
  iconifyLocalSource,
} from "astro-icon/loaders/live";

export const collections = {
  spinners: defineLiveCollection({
    loader: createLiveIconLoader(iconifyLocalSource("svg-spinners")),
  }),
};
