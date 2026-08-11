import { defineLiveCollection } from "astro:content";
import { createLiveIconLoader, iconifyLive } from "astro-icon/loaders/live";
import { serviceSource } from "service/client";

// "mdi" is installed locally (see package.json), so this resolves from disk.
const mdiLive = iconifyLive("mdi");

// "ph" isn't installed, so this falls back to fetching each requested icon
// individually from the public Iconify API (https://api.iconify.design).
const phLive = iconifyLive("ph");

// A `serviceSource` wired to `packages/service`; run `pnpm --filter service dev` first.
// `name` must match the "service" key below - a `LiveLoader` isn't told its own collection name.
const serviceLive = createLiveIconLoader(
  serviceSource("tabler", { name: "service" }),
);

export const collections = {
  mdi: defineLiveCollection({ loader: mdiLive }),
  ph: defineLiveCollection({ loader: phLive }),
  service: defineLiveCollection({ loader: serviceLive }),
};
