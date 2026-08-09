import { describe, expect, it } from "vitest";
import { extractSpriteIcons, rewriteSpriteHtml } from "../src/core/spriteRewrite.js";

const home = { viewBox: "0 0 24 24", body: "<path d=\"M1 1\"/>" };
const search = { viewBox: "0 0 24 24", body: "<path d=\"M2 2\"/>" };

describe("extractSpriteIcons", () => {
  it("returns nothing for markup with no data-icon marker", () => {
    expect(extractSpriteIcons('<div><svg><path/></svg></div>')).toEqual([]);
  });

  it("finds a single icon", () => {
    const html = '<svg width="24" height="24" data-icon="mdi:home"><path/></svg>';
    expect(extractSpriteIcons(html)).toEqual([
      { collection: "mdi", name: "home", id: "ai:mdi:home" },
    ]);
  });

  it("dedupes repeated occurrences, keeping first-seen order", () => {
    const html =
      '<svg data-icon="mdi:home"><path/></svg>' +
      '<svg data-icon="mdi:search"><path/></svg>' +
      '<svg data-icon="mdi:home"><path/></svg>';
    expect(extractSpriteIcons(html)).toEqual([
      { collection: "mdi", name: "home", id: "ai:mdi:home" },
      { collection: "mdi", name: "search", id: "ai:mdi:search" },
    ]);
  });

  it("resolves a bare (no-colon) data-icon value against the 'icons' collection", () => {
    const html = '<svg data-icon="home"><path/></svg>';
    expect(extractSpriteIcons(html)).toEqual([
      { collection: "icons", name: "home", id: "ai:icons:home" },
    ]);
  });
});

describe("rewriteSpriteHtml", () => {
  it("rewrites a single occurrence into a <use>", () => {
    const html = '<svg width="24" height="24" data-icon="mdi:home"><path d="M1 1"/></svg>';
    const out = rewriteSpriteHtml(html, new Map([["ai:mdi:home", home]]));
    expect(out).toBe(
      '<svg width="24" height="24" data-icon="mdi:home"><use href="#ai:mdi:home" /></svg>',
    );
  });

  it("rewrites every occurrence of a repeated icon, not just the first", () => {
    const html =
      '<svg data-icon="mdi:home"><path d="M1 1"/></svg>' +
      '<svg data-icon="mdi:home"><path d="M1 1"/></svg>';
    const out = rewriteSpriteHtml(html, new Map([["ai:mdi:home", home]]));
    expect(out.match(/<use href="#ai:mdi:home" \/>/g)?.length).toBe(2);
    expect(out).not.toContain("<path");
  });

  it("rewrites multiple distinct icons independently", () => {
    const html =
      '<svg data-icon="mdi:home"><path d="M1 1"/></svg>' +
      '<svg data-icon="mdi:search"><path d="M2 2"/></svg>';
    const out = rewriteSpriteHtml(
      html,
      new Map([
        ["ai:mdi:home", home],
        ["ai:mdi:search", search],
      ]),
    );
    expect(out).toContain('<use href="#ai:mdi:home" />');
    expect(out).toContain('<use href="#ai:mdi:search" />');
  });

  it("preserves each occurrence's own opening tag attrs (width/height/class)", () => {
    const html =
      '<svg width="16" class="a" data-icon="mdi:home"><path d="M1 1"/></svg>' +
      '<svg width="32" class="b" data-icon="mdi:home"><path d="M1 1"/></svg>';
    const out = rewriteSpriteHtml(html, new Map([["ai:mdi:home", home]]));
    expect(out).toContain('<svg width="16" class="a" data-icon="mdi:home">');
    expect(out).toContain('<svg width="32" class="b" data-icon="mdi:home">');
  });

  it("preserves per-instance title/desc instead of deduping them away", () => {
    const html =
      '<svg data-icon="mdi:home"><title>First</title><path d="M1 1"/></svg>' +
      '<svg data-icon="mdi:home"><title>Second</title><desc>D</desc><path d="M1 1"/></svg>';
    const out = rewriteSpriteHtml(html, new Map([["ai:mdi:home", home]]));
    expect(out).toContain('<title>First</title><use href="#ai:mdi:home" />');
    expect(out).toContain(
      '<title>Second</title><desc>D</desc><use href="#ai:mdi:home" />',
    );
  });

  it("leaves markup without a data-icon marker untouched", () => {
    const html = '<div><svg><path d="M1 1"/></svg></div>';
    const out = rewriteSpriteHtml(html, new Map([["ai:mdi:home", home]]));
    expect(out).toBe(html);
  });

  it("leaves an icon whose id isn't in resolvedSymbols untouched", () => {
    const html = '<svg data-icon="mdi:home"><path d="M1 1"/></svg>';
    const out = rewriteSpriteHtml(html, new Map());
    expect(out).toBe(html);
  });
});
