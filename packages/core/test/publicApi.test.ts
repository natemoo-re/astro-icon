import { describe, expect, it } from "vitest";
import * as root from "../src/index.js";
import * as collections from "../src/collections.js";
import * as source from "../src/source.js";
import * as optimize from "../src/optimize.js";

// Pins each entry point's *runtime* export names (type-only exports don't exist at runtime, so
// they can't be checked here - the root entry being types-plus-one-value is why its list is so
// short). A failure means the public API surface changed: deliberate changes update the list
// here AND the README/changeset; accidental ones get caught instead of shipping.
//
// `astro-icon/components` is exercised by the integration tests instead - importing `.astro`
// files needs a real Astro build, not this vitest environment.
describe("public API surface", () => {
  it("astro-icon (root): the vocabulary - every public type, plus the error class", () => {
    expect(Object.keys(root).sort()).toEqual(["AstroIconError"]);
  });

  it("astro-icon/collections: everything a config file needs", () => {
    expect(Object.keys(collections).sort()).toEqual([
      "AstroIconError",
      "createIconLoader",
      "createLiveIconLoader",
      "defineIconCollection",
      "defineLiveIconCollections",
      "iconify",
      "iconifyApi",
      "localIcons",
    ]);
  });

  it("astro-icon/source: the custom-source authoring kit", () => {
    expect(Object.keys(source).sort()).toEqual([
      "AstroIconError",
      "defineIconSource",
      "entryFromIconifyData",
      "entryFromSVG",
      "mergeSources",
    ]);
  });

  it("astro-icon/optimize: the opt-in SVGO wrapper", () => {
    expect(Object.keys(optimize).sort()).toEqual(["defaultOverrides", "svgo"]);
  });
});
