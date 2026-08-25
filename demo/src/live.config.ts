import {
  iconifyApi,
  iconify,
  defineLiveIconCollections,
} from "astro-icon/collections";
import { serviceSource } from "service/client";

export const collections = defineLiveIconCollections({
  // "mdi" is installed locally (see package.json), so this resolves from disk.
  mdi: iconify("mdi"),

  // "ph" isn't installed, so this resolves each requested icon individually
  // from the public Iconify API (https://api.iconify.design). No `allowed`
  // allowlist, since a live collection's icon names aren't known ahead of time.
  ph: iconifyApi("ph"),

  // A `serviceSource` wired to `packages/service`; run `pnpm --filter service dev` first.
  service: serviceSource("tabler"),
});
