import { defineLiveCollection } from "astro:content";
import {
  createLiveIconLoader,
  iconifyApiSource,
} from "astro-icon/loaders/live";
import { brandKitSource } from "./lib/brandKitSource";

// Live collections resolve per request. Reach for one when the icon names
// aren't merely *dynamic* (data can still be drawn from a fixed set - see the
// `nav` collection in content.config.ts) but genuinely unknowable at build
// time, because they depend on what a user does or what another system holds.
export const collections = {
  // No `icons` allowlist and nothing installed: each requested name is fetched
  // individually from api.iconify.design. A build-time collection can't express
  // this - it would have to enumerate every candidate up front.
  //
  // The source is renamed to match this key. Typegen records a live collection
  // under its *source's* name, and `iconifyApiSource("ph")` names itself
  // "iconify-api:ph" - so without this, `<LiveIcon collection="ph">` is a type
  // error against a collection that appears not to exist.
  ph: defineLiveCollection({
    loader: createLiveIconLoader({ ...iconifyApiSource("ph"), name: "ph" }),
  }),

  // A custom IconSource. Its `name` must match this key, since a LiveLoader
  // isn't told the collection name it was registered under.
  brand: defineLiveCollection({
    loader: createLiveIconLoader(brandKitSource({ name: "brand" })),
  }),
};
