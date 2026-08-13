import { defineLiveCollection } from "astro:content";
import { createLiveIconLoader, iconifyLocalSource, iconifyApiSource } from "astro-icon/loaders/live";
import { serviceSource } from "service/client";

// "mdi" is installed locally (see package.json), so this resolves from disk.
const mdiLive = createLiveIconLoader(iconifyLocalSource("mdi"));

// "ph" isn't installed, so this resolves each requested icon individually
// from the public Iconify API (https://api.iconify.design). No `icons`
// allowlist, since a live collection's icon names aren't known ahead of time.
const phLive = createLiveIconLoader(iconifyApiSource("ph"));

// A `serviceSource` wired to `packages/service`; run `pnpm --filter service dev` first.
// `name` must match the "service" key below, since a `LiveLoader` isn't told its own collection name.
const serviceLive = createLiveIconLoader(
  serviceSource("tabler", { name: "service" }),
);

export const collections = {
  mdi: defineLiveCollection({ loader: mdiLive }),
  ph: defineLiveCollection({ loader: phLive }),
  service: defineLiveCollection({ loader: serviceLive }),
};
