import {
  iconifyApiSource,
  iconifyLocalSource,
  liveIconCollections,
} from "astro-icon/loaders/live";
import { serviceSource } from "service/client";

export const collections = liveIconCollections({
  // "mdi" is installed locally (see package.json), so this resolves from disk.
  mdi: iconifyLocalSource("mdi"),

  // "ph" isn't installed, so this resolves each requested icon individually
  // from the public Iconify API (https://api.iconify.design). No `allowed`
  // allowlist, since a live collection's icon names aren't known ahead of time.
  ph: iconifyApiSource("ph"),

  // A `serviceSource` wired to `packages/service`; run `pnpm --filter service dev` first.
  service: serviceSource("tabler"),
});
