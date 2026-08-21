import { defineLiveCollection } from "astro:content";
import {
  createLiveIconLoader,
  iconifyLocalSource,
  iconifyApiSource,
} from "astro-icon/loaders/live";

// "mdi" is installed locally (see package.json), so this resolves from disk.
const mdiLive = createLiveIconLoader(iconifyLocalSource("mdi"));

// "ph" isn't installed, so this resolves each requested icon individually
// from the public Iconify API (https://api.iconify.design). No `icons`
// allowlist, since a live collection's icon names aren't known ahead of time.
const phLive = createLiveIconLoader(iconifyApiSource("ph"));

export const collections = {
  mdi: defineLiveCollection({ loader: mdiLive }),
  ph: defineLiveCollection({ loader: phLive }),
};
