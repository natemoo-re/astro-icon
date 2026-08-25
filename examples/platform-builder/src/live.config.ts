import { iconifyApi, liveIconCollections } from "astro-icon/collections";
import { brandKitSource } from "./lib/brandKitSource";

// Live collections resolve per request. Reach for one when the icon names
// aren't merely *dynamic* (data can still be drawn from a fixed set - see the
// `nav` collection in content.config.ts) but genuinely unknowable at build
// time, because they depend on what a user does or what another system holds.
//
// `liveIconCollections()` writes each key once - it becomes both the Astro
// collection key and the generated `LiveCollectionName` type, so there's no
// separate `name`/`collection` option to keep in sync by hand.
export const collections = {
  // No `allowed` allowlist and nothing installed: each requested name is fetched
  // individually from api.iconify.design. A build-time collection can't express
  // this - it would have to enumerate every candidate up front.
  ...liveIconCollections({
    ph: iconifyApi("ph"),

    // A custom IconSource.
    brand: brandKitSource({ name: "brand" }),
  }),
};
