import { describe, expect, it } from "vitest";
import { renderableIconProps } from "../src/render/props.js";

const entry = { body: "", width: 24, height: 24, viewBox: "0 0 24 24" };

describe("renderableIconProps", () => {
  it("defaults width/height/viewBox from the entry when props set none of them", () => {
    const { normalizedProps } = renderableIconProps(entry, {});
    expect(normalizedProps).toEqual({
      width: 24,
      height: 24,
      viewBox: "0 0 24 24",
    });
  });

  it("folds size into width and height, dropping size", () => {
    const { normalizedProps } = renderableIconProps(entry, { size: 32 });
    expect(normalizedProps).toEqual({
      width: 32,
      height: 32,
      viewBox: "0 0 24 24",
    });
    expect(normalizedProps).not.toHaveProperty("size");
  });

  it("lets an explicit width/height override the entry's when size isn't set", () => {
    const { normalizedProps } = renderableIconProps(entry, { width: 40 });
    expect(normalizedProps).toEqual({
      width: 40,
      height: 24,
      viewBox: "0 0 24 24",
    });
  });

  it("lets size win over an explicit width/height", () => {
    const { normalizedProps } = renderableIconProps(entry, {
      size: 32,
      width: 100,
      height: 100,
    });
    expect(normalizedProps).toEqual({
      width: 32,
      height: 32,
      viewBox: "0 0 24 24",
    });
  });

  it("lets an explicit null width/height override the entry's, to omit the attribute", () => {
    const { normalizedProps } = renderableIconProps(entry, {
      width: null,
      height: null,
    });
    expect(normalizedProps).toEqual({
      width: null,
      height: null,
      viewBox: "0 0 24 24",
    });
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

  it("defaults extra entry fields (e.g. a local icon's own root fill/stroke/class) onto the props", () => {
    const withRootAttrs = {
      ...entry,
      fill: "none",
      stroke: "currentColor",
      class: "h-6 w-6",
    };
    const { normalizedProps } = renderableIconProps(withRootAttrs, {});
    expect(normalizedProps).toMatchObject({
      fill: "none",
      stroke: "currentColor",
      class: "h-6 w-6",
    });
  });

  it("lets a caller's own prop override a defaulted root attribute - the whole point of storing them as entry fields instead of baking them into body", () => {
    const withRootAttrs = { ...entry, fill: "none", stroke: "currentColor" };
    const { normalizedProps } = renderableIconProps(withRootAttrs, {
      fill: "red",
    });
    expect(normalizedProps).toMatchObject({
      fill: "red",
      stroke: "currentColor",
    });
  });

  it("never leaks body/title/desc onto the rendered <svg>'s props", () => {
    const withExtras = {
      ...entry,
      body: "<path/>",
      title: "A title",
      desc: "A desc",
    };
    const { normalizedProps } = renderableIconProps(withExtras, {});
    expect(normalizedProps).not.toHaveProperty("body");
    expect(normalizedProps).not.toHaveProperty("title");
    expect(normalizedProps).not.toHaveProperty("desc");
  });
});
