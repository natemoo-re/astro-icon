import { defineIconCollection, localIcons } from "astro-icon/collections";

// Everything in this file is what a real published package (e.g. an
// `acme-ui` npm package) would ship from its own `src/icons.ts`. It never
// imports anything from outside `src/lib/`, and it never touches the
// consumer's astro.config.mjs or layout - a library can't require either.
export const acmeUiIcons = {
  // Namespaced so this can't collide with a collection key the consumer
  // picks for their own icons (see src/content.config.ts).
  "acme-ui-icons": defineIconCollection(
    // `localIcons(new URL(...))` resolves relative to *this file*, not
    // the consuming project's root - a plain relative string would
    // (wrongly) resolve against whichever app imported this module.
    localIcons(new URL("./icons/", import.meta.url)),
  ),
};
