import { defineLiveCollection } from "astro:content";
import { createLiveIconLoader, iconify } from "astro-icon/collections";

// The raw registration form; the `live` fixture covers `defineLiveIconCollections()`.
export const collections = {
  liveSpinners: defineLiveCollection({
    loader: createLiveIconLoader(iconify("svg-spinners"), {
      collection: "liveSpinners",
    }),
  }),
};
