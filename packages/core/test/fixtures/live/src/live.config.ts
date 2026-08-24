import {
  iconifyLocalSource,
  liveIconCollections,
} from "astro-icon/loaders/live";

export const collections = liveIconCollections({
  spinners: iconifyLocalSource("svg-spinners"),
});
