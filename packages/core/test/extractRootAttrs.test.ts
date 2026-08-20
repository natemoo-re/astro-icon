import { describe, expect, it } from "vitest";
import { extractRootAttrs } from "../src/content/local/extractRootAttrs.js";

describe("extractRootAttrs", () => {
  it("reads the root tag's non-structural attributes into a plain object", () => {
    expect(
      extractRootAttrs(
        '<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M0 0"/></svg>',
      ),
    ).toEqual({ fill: "none", stroke: "currentColor" });
  });

  it("drops xmlns/xmlns:xlink/version/viewBox/width/height, handled elsewhere", () => {
    expect(
      extractRootAttrs(
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" viewBox="0 0 24 24" width="24" height="24"><path d="M0 0"/></svg>',
      ),
    ).toEqual({});
  });

  it("returns an empty object when the root tag has no attributes worth keeping", () => {
    expect(
      extractRootAttrs('<svg viewBox="0 0 24 24"><path d="M0 0"/></svg>'),
    ).toEqual({});
  });

  it("keeps any attribute, not just color-related ones (class, style, id, ...)", () => {
    expect(
      extractRootAttrs(
        '<svg viewBox="0 0 24 24" class="h-6 w-6" style="opacity:.5" id="icon"><path d="M0 0"/></svg>',
      ),
    ).toEqual({ class: "h-6 w-6", style: "opacity:.5", id: "icon" });
  });

  it("drops role/aria-*/focusable/tabindex - <Icon>'s own a11y contract owns those, not the source file's", () => {
    expect(
      extractRootAttrs(
        '<svg viewBox="0 0 24 24" aria-hidden="true" role="img" focusable="false" tabindex="-1" fill="currentColor"><path d="M0 0"/></svg>',
      ),
    ).toEqual({ fill: "currentColor" });
  });
});
