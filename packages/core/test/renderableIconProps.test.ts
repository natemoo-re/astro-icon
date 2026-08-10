import { describe, expect, it } from "vitest";
import { renderableIconProps } from "../src/core/renderableIconProps.js";

const entry = { width: 24, height: 24, viewBox: "0 0 24 24" };

describe("renderableIconProps", () => {
  it("defaults width/height/viewBox from the entry when props set none of them", () => {
    const { normalizedProps } = renderableIconProps(entry, {});
    expect(normalizedProps).toEqual({ width: 24, height: 24, viewBox: "0 0 24 24" });
  });

  it("folds size into width and height, dropping size", () => {
    const { normalizedProps } = renderableIconProps(entry, { size: 32 });
    expect(normalizedProps).toEqual({ width: 32, height: 32, viewBox: "0 0 24 24" });
    expect(normalizedProps).not.toHaveProperty("size");
  });

  it("lets an explicit width/height override the entry's when size isn't set", () => {
    const { normalizedProps } = renderableIconProps(entry, { width: 40 });
    expect(normalizedProps).toEqual({ width: 40, height: 24, viewBox: "0 0 24 24" });
  });

  it("lets size win over an explicit width/height", () => {
    const { normalizedProps } = renderableIconProps(entry, {
      size: 32,
      width: 100,
      height: 100,
    });
    expect(normalizedProps).toEqual({ width: 32, height: 32, viewBox: "0 0 24 24" });
  });

  it("passes through unrelated props untouched", () => {
    const { normalizedProps } = renderableIconProps(entry, {
      class: "icon",
      "data-foo": "bar",
    });
    expect(normalizedProps).toEqual({
      width: 24,
      height: 24,
      viewBox: "0 0 24 24",
      class: "icon",
      "data-foo": "bar",
    });
  });
});
