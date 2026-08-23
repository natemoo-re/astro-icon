import { defineLiveCollection } from "astro:content";
import {
  createLiveIconLoader,
  iconifyLocalSource,
} from "astro-icon/loaders/live";

// The raw registration form; the `live` fixture covers `liveIconCollections()`.
export const collections = {
  liveSpinners: defineLiveCollection({
    loader: createLiveIconLoader(iconifyLocalSource("svg-spinners"), {
      collection: "liveSpinners",
    }),
  }),
};
