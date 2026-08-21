import { describe, expect, it } from "vitest";
import {
  sanitizeRootAttrs,
  sanitizeSVGBody,
} from "../src/content/sanitizeSVG.js";

describe("sanitizeSVGBody / removes active content", () => {
  it("removes a <script> element", () => {
    expect(sanitizeSVGBody('<path d="M0 0"/><script>alert(1)</script>')).toBe(
      '<path d="M0 0" />',
    );
  });

  it("removes a <script> element regardless of case", () => {
    expect(sanitizeSVGBody("<ScRiPt>alert(1)</ScRiPt>")).toBe("");
  });

  it("removes a <foreignObject> element and its contents", () => {
    expect(
      sanitizeSVGBody(
        '<foreignObject><div onclick="alert(1)">hi</div></foreignObject>',
      ),
    ).toBe("");
  });

  it("removes <foreignObject> regardless of case", () => {
    expect(sanitizeSVGBody("<FOREIGNOBJECT>hi</FOREIGNOBJECT>")).toBe("");
  });

  it("strips on* event handler attributes but keeps the element", () => {
    expect(sanitizeSVGBody('<path d="M0 0" onload="alert(1)"/>')).toBe(
      '<path d="M0 0" />',
    );
  });

  it("strips event handler attributes regardless of case", () => {
    expect(sanitizeSVGBody('<path d="M0 0" OnLoad="alert(1)"/>')).toBe(
      '<path d="M0 0" />',
    );
  });

  it("strips a javascript: URI from href but keeps the element", () => {
    expect(sanitizeSVGBody('<a href="javascript:alert(1)">x</a>')).toBe(
      "<a>x</a>",
    );
  });

  it("strips a javascript: URI obfuscated with whitespace/control characters", () => {
    expect(sanitizeSVGBody('<a href="jav\tascript:alert(1)">x</a>')).toBe(
      "<a>x</a>",
    );
  });

  it("strips a data:text/html URI from xlink:href", () => {
    // No raw `<`/`>` in the attribute value - the tokenizer's attribute capture isn't
    // quote-aware, so a literal `>` inside a quoted value would end the tag early.
    expect(
      sanitizeSVGBody('<use xlink:href="data:text/html;base64,PHNjcmlwdD4="/>'),
    ).toBe("<use />");
  });

  it("strips a javascript: URI from src", () => {
    expect(sanitizeSVGBody('<image src="javascript:alert(1)"/>')).toBe(
      "<image />",
    );
  });

  it("keeps a comment that sits alongside content it strips, even though stripping forces a re-serialize", () => {
    expect(
      sanitizeSVGBody(
        '<!-- CC BY 4.0 --><path d="M0 0"/><script>alert(1)</script>',
      ),
    ).toBe('<!-- CC BY 4.0 --><path d="M0 0" />');
  });
});

describe("sanitizeSVGBody / leaves legitimate content byte-for-byte untouched", () => {
  // When nothing dangerous is found, the input is returned as-is rather than re-serialized
  // through ultrahtml's renderer, which would otherwise normalize formatting (e.g.
  // `<path/>` -> `<path />`) that a mandatory security pass has no business changing.

  it("keeps comments (e.g. license notices)", () => {
    const svg = '<!-- CC BY 4.0 --><path d="M0 0"/>';
    expect(sanitizeSVGBody(svg)).toBe(svg);
  });

  it("keeps <text> elements", () => {
    const svg = '<text x="0" y="0">A</text>';
    expect(sanitizeSVGBody(svg)).toBe(svg);
  });

  it("keeps <style> blocks", () => {
    const svg = "<style>.a{fill:red}</style>";
    expect(sanitizeSVGBody(svg)).toBe(svg);
  });

  it("keeps a fragment-only href (e.g. a gradient/mask reference)", () => {
    const svg = '<use href="#a"/>';
    expect(sanitizeSVGBody(svg)).toBe(svg);
  });

  it("keeps explicit fill colors untouched", () => {
    const svg = '<path fill="#ff0000" d="M0 0"/>';
    expect(sanitizeSVGBody(svg)).toBe(svg);
  });

  it("keeps gradients, masks, and defs", () => {
    const svg =
      '<defs><linearGradient id="g"><stop offset="0" stop-color="#000"/></linearGradient></defs><rect fill="url(#g)" width="1" height="1"/>';
    expect(sanitizeSVGBody(svg)).toBe(svg);
  });

  it("returns an empty string unchanged", () => {
    expect(sanitizeSVGBody("")).toBe("");
  });
});

describe("sanitizeRootAttrs", () => {
  it("strips an on* event handler attribute (e.g. a malicious root <svg onload=...>)", () => {
    expect(
      sanitizeRootAttrs({
        onload: "alert(1)",
        fill: "currentColor",
        width: 24,
        height: 24,
      }),
    ).toEqual({ fill: "currentColor", width: 24, height: 24 });
  });

  it("strips an on* attribute regardless of case", () => {
    expect(sanitizeRootAttrs({ OnLoad: "alert(1)", fill: "none" })).toEqual({
      fill: "none",
    });
  });

  it("strips a javascript: URI from href", () => {
    expect(
      sanitizeRootAttrs({ href: "javascript:alert(1)", class: "icon" }),
    ).toEqual({ class: "icon" });
  });

  it("strips a data:text/html URI from xlink:href", () => {
    expect(
      sanitizeRootAttrs({
        "xlink:href": "data:text/html;base64,PHNjcmlwdD4=",
        stroke: "currentColor",
      }),
    ).toEqual({ stroke: "currentColor" });
  });

  it("keeps known-safe structural/presentation attributes untouched", () => {
    const attrs = {
      viewBox: "0 0 24 24",
      width: 24,
      height: 24,
      xmlns: "http://www.w3.org/2000/svg",
      fill: "currentColor",
      "aria-hidden": "true",
      role: "img",
    };
    expect(sanitizeRootAttrs(attrs)).toEqual(attrs);
  });

  it("returns the original object unchanged (same reference) when nothing needs stripping", () => {
    const attrs = { fill: "currentColor" };
    expect(sanitizeRootAttrs(attrs)).toBe(attrs);
  });

  it("leaves a non-string value (e.g. width/height as numbers) untouched", () => {
    expect(sanitizeRootAttrs({ width: 24, onload: "alert(1)" })).toEqual({
      width: 24,
    });
  });
});
