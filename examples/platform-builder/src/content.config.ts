import { defineCollection } from "astro:content";
import { createIconLoader, iconifyLocalSource } from "astro-icon/loaders";

// Two build-time collections, for the two shapes "dynamic icon names" actually
// takes - the distinction this persona has to get right.
export const collections = {
  // The names come from data, but the *set* they're drawn from is curated: the
  // CMS only lets an editor pick one of these. Bounded, so it sprites normally
  // and `<Icon name={row.icon}>` still gets every optimization a literal would.
  nav: defineCollection({
    loader: createIconLoader(
      iconifyLocalSource("mdi", {
        icons: [
          "home",
          "account-group",
          "chart-line",
          "cog",
          "book-open-variant",
          "lifebuoy",
          "credit-card",
          "shield-check",
        ],
      }),
    ),
  }),

  // The whole pack (7,000+ icons), because an end user picking from a catalog
  // can land on any of them. `sprite: false` because the alternative is an
  // external sprite asset containing the entire pack, fetched by every SSR page
  // that touches this collection - megabytes to save bytes. Unbounded plus SSR
  // is precisely the case the sprite build warns about; this is the opt-out.
  catalog: defineCollection({
    loader: createIconLoader(iconifyLocalSource("mdi"), { sprite: false }),
  }),
};
