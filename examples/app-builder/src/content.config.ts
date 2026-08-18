import { defineCollection } from "astro:content";
import { createIconLoader, iconifyLocalSource, localIcons } from "astro-icon/loaders";

// A design-system-sized icon set: one Iconify pack curated down to the ~30
// icons this dashboard actually uses (omitting `icons` would ship all of
// mdi), plus a local collection for the brand mark.
export const collections = {
  brand: defineCollection({ loader: localIcons() }),
  mdi: defineCollection({
    loader: createIconLoader(
      iconifyLocalSource("mdi", {
        icons: [
          "view-dashboard",
          "account-group",
          "cog",
          "chart-line",
          "bell",
          "magnify",
          "pencil",
          "delete",
          "eye",
          "download",
          "filter",
          "plus",
          "close",
          "check",
          "alert",
          "logout",
          "menu",
          "dots-vertical",
          "star",
          "star-outline",
          "file-document",
          "folder",
          "calendar",
          "clock",
          "refresh",
          "upload",
          "link",
          "lock",
          "email",
          "arrow-left",
        ],
      }),
    ),
  }),
};
