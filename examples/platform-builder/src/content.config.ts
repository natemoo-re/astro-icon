import { defineCollection } from "astro:content";
import { createIconLoader, iconifyLocalSource } from "astro-icon/loaders";

// Two build-time collections, for the two shapes "dynamic icon names" actually
// takes - the distinction this persona has to get right.
export const collections = {
  // The names come from data, but the *set* they're drawn from is curated: the
  // CMS only lets an editor pick one of these. Bounded, so `<Icon name={row.icon}>`
  // still type-checks and resolves at build time, exactly like a literal name.
  nav: defineCollection({
    loader: createIconLoader(
      iconifyLocalSource("mdi", {
        allowed: [
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
  // can land on any of them - no `allowed` allowlist to enumerate. That means
  // every sync loads and types the full mdi pack; a name assembled from that
  // catalog at runtime also needs an `as IconName` cast, since it can't satisfy
  // a union of concrete names (see src/pages/picker.astro).
  catalog: defineCollection({
    loader: createIconLoader(iconifyLocalSource("mdi")),
  }),
};
