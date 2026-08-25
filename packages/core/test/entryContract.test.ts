import { describe, expect, it } from "vitest";
import {
  iconEntrySchema,
  rootAttrOwner,
  splitEntryAttrs,
} from "../src/internal/entryContract.js";

describe("rootAttrOwner", () => {
  it("routes viewBox/width/height/xmlns/version to structure", () => {
    for (const name of [
      "viewBox",
      "width",
      "height",
      "xmlns",
      "xmlns:xlink",
      "version",
    ]) {
      expect(rootAttrOwner(name)).toBe("structure");
    }
  });

  it("routes role/focusable/tabindex/aria-* to component", () => {
    for (const name of [
      "role",
      "focusable",
      "tabindex",
      "aria-hidden",
      "aria-label",
    ]) {
      expect(rootAttrOwner(name)).toBe("component");
    }
  });

  it("is case-insensitive", () => {
    expect(rootAttrOwner("VIEWBOX")).toBe("structure");
    expect(rootAttrOwner("ARIA-Hidden")).toBe("component");
  });

  it("routes everything else (presentation attributes) to entry", () => {
    for (const name of ["fill", "stroke", "class", "style", "data-foo"]) {
      expect(rootAttrOwner(name)).toBe("entry");
    }
  });
});

describe("splitEntryAttrs", () => {
  it("pulls body/title/desc out, leaving everything else as attrs", () => {
    const { body, title, desc, attrs } = splitEntryAttrs({
      body: "<path/>",
      viewBox: "0 0 24 24",
      width: 24,
      height: 24,
      title: "A title",
      desc: "A desc",
      fill: "currentColor",
    });

    expect(body).toBe("<path/>");
    expect(title).toBe("A title");
    expect(desc).toBe("A desc");
    expect(attrs).toEqual({
      viewBox: "0 0 24 24",
      width: 24,
      height: 24,
      fill: "currentColor",
    });
  });

  it("leaves title/desc undefined when the entry doesn't have them", () => {
    const { title, desc, attrs } = splitEntryAttrs({
      body: "<path/>",
      viewBox: "0 0 24 24",
      width: 24,
      height: 24,
    });

    expect(title).toBeUndefined();
    expect(desc).toBeUndefined();
    expect(attrs).not.toHaveProperty("title");
    expect(attrs).not.toHaveProperty("desc");
    expect(attrs).not.toHaveProperty("body");
  });
});

describe("iconEntrySchema", () => {
  const valid = {
    body: "<path/>",
    viewBox: "0 0 24 24",
    width: 24,
    height: 24,
  };

  it("accepts the minimal shape", () => {
    expect(iconEntrySchema.safeParse(valid).success).toBe(true);
  });

  it("accepts extra string/number fields through the catchall", () => {
    const result = iconEntrySchema.safeParse({
      ...valid,
      fill: "currentColor",
      "stroke-width": 2,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing required field", () => {
    const { width: _width, ...rest } = valid;
    expect(iconEntrySchema.safeParse(rest).success).toBe(false);
  });

  it("rejects a wrong-typed required field", () => {
    expect(iconEntrySchema.safeParse({ ...valid, width: "24" }).success).toBe(
      false,
    );
  });

  it("rejects an extra field of the wrong type through the catchall", () => {
    expect(
      iconEntrySchema.safeParse({ ...valid, extra: { nested: true } }).success,
    ).toBe(false);
  });
});
