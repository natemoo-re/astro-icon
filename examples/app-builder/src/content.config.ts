import { defineCollection } from "astro:content";
import { createIconLoader, iconifyLocalSource, localSource } from "astro-icon/loaders";

// The design-system icon set for a real dashboard: three Heroicons packs
// (the sets Flowbite's components draw from), each curated down with an
// `allowed` list to exactly the icons this app renders - omitting `allowed`
// would sync and type the entire pack. The one-off artwork that is *not*
// part of the design system (country flags, payment-network logos, social
// glyphs, illustrations) stays as inline <svg> in the templates, which is
// where non-icon artwork belongs.
export const collections = {
  // The brand mark, from a local .svg - the only icon this app owns outright.
  brand: defineCollection({ loader: createIconLoader(localSource()) }),

  // Heroicons v1, solid + outline - the bulk of the template's icons.
  "heroicons-solid": defineCollection({
    loader: createIconLoader(
      iconifyLocalSource("heroicons-solid", {
        allowed: [
          "adjustments",
          "annotation",
          "archive",
          "arrow-narrow-left",
          "arrow-narrow-right",
          "arrow-narrow-up",
          "bell",
          "calendar-days",
          "chart-pie",
          "check-circle",
          "chevron-down",
          "chevron-left",
          "chevron-right",
          "chevron-up",
          "clipboard-list",
          "cog",
          "collection",
          "computer-desktop",
          "currency-dollar",
          "document-download",
          "dots-horizontal",
          "dots-vertical",
          "exclamation-circle",
          "eye",
          "heart",
          "home",
          "inbox",
          "inbox-in",
          "location-marker",
          "lock-closed",
          "menu-alt-1",
          "moon",
          "paper-airplane",
          "paper-clip",
          "pencil-alt",
          "photograph",
          "plus-sm",
          "question-mark-circle",
          "receipt-tax",
          "search",
          "shopping-bag",
          "sun",
          "support",
          "template",
          "trash",
          "user-add",
          "user-circle",
          "user-group",
          "video-camera",
          "view-grid",
          "x",
        ],
      }),
    ),
  }),
  "heroicons-outline": defineCollection({
    loader: createIconLoader(
      iconifyLocalSource("heroicons-outline", {
        allowed: [
          "arrow-narrow-right",
          "chevron-down",
          "chevron-right",
          "exclamation-circle",
          "login",
        ],
      }),
    ),
  }),

  // Heroicons v2, for the icons the template took from the newer set.
  heroicons: defineCollection({
    loader: createIconLoader(
      iconifyLocalSource("heroicons", {
        allowed: [
          "academic-cap-20-solid",
          "arrow-down-20-solid",
          "arrow-down-tray-solid",
          "arrow-long-right-20-solid",
          "arrow-path",
          "arrow-up-20-solid",
          "check-20-solid",
          "device-phone-mobile-20-solid",
          "device-tablet-20-solid",
          "document-text-solid",
          "fire-20-solid",
          "rocket-launch-20-solid",
          "table-cells-20-solid",
        ],
      }),
    ),
  }),
};
