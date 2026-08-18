import { describe, expect, it } from "vitest";
import { looksLikeItNeedsCurrentColor } from "../src/content/local/currentColorHint.js";

describe("looksLikeItNeedsCurrentColor", () => {
  it("is false when the icon already uses currentColor", () => {
    expect(
      looksLikeItNeedsCurrentColor('<path fill="currentColor" d="M0 0"/>'),
    ).toBe(false);
  });

  it("is false when currentColor is used anywhere, even alongside other colors", () => {
    expect(
      looksLikeItNeedsCurrentColor(
        '<path fill="currentColor" d="M0 0"/><path fill="#ff0000" d="M1 1"/>',
      ),
    ).toBe(false);
  });

  it("is true for a shape with no explicit fill/stroke at all (relies on default black)", () => {
    expect(looksLikeItNeedsCurrentColor('<path d="M0 0"/>')).toBe(true);
  });

  it("is true for a single explicit color used consistently", () => {
    expect(
      looksLikeItNeedsCurrentColor(
        '<path fill="#000" d="M0 0"/><path fill="#000" d="M1 1"/>',
      ),
    ).toBe(true);
  });

  it("is false for two or more distinct explicit colors (reads as a deliberate multi-color graphic)", () => {
    expect(
      looksLikeItNeedsCurrentColor(
        '<path fill="#ff0000" d="M0 0"/><path fill="#0000ff" d="M1 1"/>',
      ),
    ).toBe(false);
  });

  it('ignores fill="none"/stroke="none" when counting distinct colors', () => {
    expect(
      looksLikeItNeedsCurrentColor(
        '<path fill="none" stroke="#000" d="M0 0"/>',
      ),
    ).toBe(true);
  });

  it("is case-insensitive for currentColor", () => {
    expect(
      looksLikeItNeedsCurrentColor('<path fill="CURRENTCOLOR" d="M0 0"/>'),
    ).toBe(false);
  });
});
