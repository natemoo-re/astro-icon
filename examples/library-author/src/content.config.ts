import { defineCollection } from "astro:content";
import { createIconLoader, localSource } from "astro-icon/loaders";
import { acmeUiIcons } from "./lib/icons";

// This is the only line that "installs" the library: a spread, the same way
// any other astro-icon consumer would add `my-lib/icons` from node_modules.
// `src/lib/` just happens to live in this repo instead of a separate one.
export const collections = {
  ...acmeUiIcons,
  icons: defineCollection({ loader: createIconLoader(localSource()) }),
};
