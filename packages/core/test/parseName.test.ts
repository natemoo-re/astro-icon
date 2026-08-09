import { describe, expect, it } from "vitest";
import { parseIconName, parseLiveIconName } from "../src/core/parseName.js";

describe("parseIconName", () => {
  it("resolves a bare name against the 'icons' collection", () => {
    expect(parseIconName("search")).toEqual({
      collection: "icons",
      name: "search",
      hasPrefix: false,
    });
  });

  it("splits collection:name on the first colon", () => {
    expect(parseIconName("mdi:search")).toEqual({
      collection: "mdi",
      name: "search",
      hasPrefix: true,
    });
  });

  it("only splits on the first colon, preserving the rest of the name", () => {
    expect(parseIconName("mdi:a:b")).toEqual({
      collection: "mdi",
      name: "a:b",
      hasPrefix: true,
    });
  });

  it("treats a leading colon as an empty collection, not local", () => {
    expect(parseIconName(":foo")).toEqual({
      collection: "",
      name: "foo",
      hasPrefix: true,
    });
  });
});

describe("parseLiveIconName", () => {
  it("requires a collection prefix", () => {
    expect(parseLiveIconName("search")).toBeUndefined();
  });

  it("splits collection:name on the first colon", () => {
    expect(parseLiveIconName("mdi:search")).toEqual({
      collection: "mdi",
      name: "search",
      hasPrefix: true,
    });
  });
});
