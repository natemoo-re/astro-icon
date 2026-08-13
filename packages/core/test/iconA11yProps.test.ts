import { afterEach, describe, expect, it, vi } from "vitest";
import { iconA11yProps } from "../src/render/props.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("iconA11yProps / decorative default", () => {
  it("hides the icon by default when nothing labels it", () => {
    const { a11yProps, titleId, descId } = iconA11yProps(undefined, undefined, {});
    expect(a11yProps).toEqual({ focusable: "false", "aria-hidden": "true" });
    expect(titleId).toBeUndefined();
    expect(descId).toBeUndefined();
  });

  it("stays decorative when only unrelated props are set", () => {
    const { a11yProps } = iconA11yProps(undefined, undefined, { class: "icon" } as never);
    expect(a11yProps).toEqual({ focusable: "false", "aria-hidden": "true" });
  });
});

describe("iconA11yProps / title and desc wiring", () => {
  it("wires role, aria-labelledby, and a matching <title> id when title is set", () => {
    const { a11yProps, titleId, descId } = iconA11yProps("Search", undefined, {});
    expect(titleId).toMatch(/^astro-icon-title-/);
    expect(descId).toBeUndefined();
    expect(a11yProps).toEqual({
      focusable: "false",
      role: "img",
      "aria-labelledby": titleId,
    });
  });

  it("wires role, aria-describedby, and a matching <desc> id when desc is set", () => {
    const { a11yProps, titleId, descId } = iconA11yProps(undefined, "More detail", {});
    expect(titleId).toBeUndefined();
    expect(descId).toMatch(/^astro-icon-desc-/);
    expect(a11yProps).toEqual({
      focusable: "false",
      role: "img",
      "aria-describedby": descId,
    });
  });

  it("wires both when title and desc are both set", () => {
    const { a11yProps, titleId, descId } = iconA11yProps("Search", "More detail", {});
    expect(a11yProps).toEqual({
      focusable: "false",
      role: "img",
      "aria-labelledby": titleId,
      "aria-describedby": descId,
    });
  });

  it("generates a different id per call", () => {
    const first = iconA11yProps("Search", undefined, {});
    const second = iconA11yProps("Search", undefined, {});
    expect(first.titleId).not.toBe(second.titleId);
  });
});

describe("iconA11yProps / explicit overrides win", () => {
  it("skips generating a title id when the caller already set aria-label", () => {
    const { a11yProps, titleId } = iconA11yProps("Search", undefined, { "aria-label": "Look" });
    expect(titleId).toBeUndefined();
    expect(a11yProps).toEqual({ focusable: "false", role: "img" });
  });

  it("skips generating a title id when the caller already set aria-labelledby", () => {
    const { titleId } = iconA11yProps("Search", undefined, { "aria-labelledby": "external-id" });
    expect(titleId).toBeUndefined();
  });

  it("skips generating a desc id when the caller already set aria-description", () => {
    const { descId } = iconA11yProps(undefined, "More", { "aria-description": "More, really" });
    expect(descId).toBeUndefined();
  });

  it("skips generating a desc id when the caller already set aria-describedby", () => {
    const { descId } = iconA11yProps(undefined, "More", { "aria-describedby": "external-id" });
    expect(descId).toBeUndefined();
  });

  it("treats an explicit role alone (no title/desc) as opting out of the decorative default", () => {
    const { a11yProps } = iconA11yProps(undefined, undefined, { role: "presentation" });
    expect(a11yProps).toEqual({ focusable: "false", role: "img" });
  });

  it("treats an explicit aria-label alone (no title/desc) as opting out of the decorative default", () => {
    const { a11yProps } = iconA11yProps(undefined, undefined, { "aria-label": "Look" });
    expect(a11yProps).toEqual({ focusable: "false", role: "img" });
  });

  it("always includes focusable: false, decorative or not", () => {
    expect(iconA11yProps(undefined, undefined, {}).a11yProps.focusable).toBe("false");
    expect(iconA11yProps("Search", undefined, {}).a11yProps.focusable).toBe("false");
  });
});

describe("iconA11yProps / dev warnings", () => {
  it("warns when title is set alongside an explicit aria-label", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    iconA11yProps("Search", undefined, { "aria-label": "Look" });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"title"'));
  });

  it("warns when desc is set alongside an explicit aria-describedby", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    iconA11yProps(undefined, "More", { "aria-describedby": "external-id" });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"desc"'));
  });

  it("warns when a labeled icon is also explicitly aria-hidden", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    iconA11yProps("Search", undefined, { "aria-hidden": "true" });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("aria-hidden"));
  });

  it("warns when a labeled icon is aria-hidden as a real boolean", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    iconA11yProps("Search", undefined, { "aria-hidden": true });
    expect(warn).toHaveBeenCalledOnce();
  });

  it("doesn't warn for the plain decorative default", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    iconA11yProps(undefined, undefined, {});
    expect(warn).not.toHaveBeenCalled();
  });

  it("doesn't warn when aria-hidden is set on an otherwise-unlabeled (decorative) icon", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    iconA11yProps(undefined, undefined, { "aria-hidden": "true" });
    expect(warn).not.toHaveBeenCalled();
  });

  it("doesn't warn when title/desc are set with no conflicting props", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    iconA11yProps("Search", "More", {});
    expect(warn).not.toHaveBeenCalled();
  });
});
