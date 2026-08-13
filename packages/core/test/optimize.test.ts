import { describe, expect, it } from "vitest";
import { defaultOverrides, svgo } from "../src/optimize.js";

const ctx = { collection: "test", name: "icon" };

describe("svgo() / default (no options)", () => {
  it("collapses whitespace inside attribute values", async () => {
    const optimize = svgo();
    const out = await optimize(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M1   2L3 4" /></svg>',
      ctx,
    );
    expect(out).toContain('d="M1 2L3 4"');
  });

  it("rounds numeric precision on non-path attributes (path data itself is left alone - see convertPathData in defaultOverrides)", async () => {
    const optimize = svgo();
    const out = await optimize(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="1.23456789" cy="1" r="1" /></svg>',
      ctx,
    );
    expect(out).toContain('cx="1.235"');
  });

  it("never rewrites an explicit color", async () => {
    const optimize = svgo();
    const out = await optimize(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#ff0000" d="M1 2L3 4" /></svg>',
      ctx,
    );
    expect(out).toContain('fill="#ff0000"');
  });

  it("keeps comments (e.g. a license notice)", async () => {
    const optimize = svgo();
    const out = await optimize(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><!-- CC BY 4.0 --><path d="M1 2L3 4" /></svg>',
      ctx,
    );
    expect(out).toContain("CC BY 4.0");
  });

  it("keeps <desc>", async () => {
    const optimize = svgo();
    const out = await optimize(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><desc>A description</desc><path d="M1 2L3 4" /></svg>',
      ctx,
    );
    expect(out).toContain("<desc>A description</desc>");
  });

  it("doesn't merge multiple <path> elements into one", async () => {
    const optimize = svgo();
    const out = await optimize(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M1 2L3 4" /><path d="M5 6L7 8" /></svg>',
      ctx,
    );
    expect(out.match(/<path/g)).toHaveLength(2);
  });

  it("doesn't convert <circle> to <path>", async () => {
    const optimize = svgo();
    const out = await optimize(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /></svg>',
      ctx,
    );
    expect(out).toContain("<circle");
  });

  it("keeps ids untouched", async () => {
    const optimize = svgo();
    const out = await optimize(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><mask id="mdi-home-mask"><path d="M1 2L3 4" /></mask></svg>',
      ctx,
    );
    expect(out).toContain('id="mdi-home-mask"');
  });
});

describe("svgo() / options replace the default wholesale", () => {
  it("plugins: ['preset-default'] runs SVGO's own untouched default (comments stripped)", async () => {
    const optimize = svgo({ plugins: ["preset-default"] });
    const out = await optimize(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><!-- gone --><path d="M1 2L3 4" /></svg>',
      ctx,
    );
    expect(out).not.toContain("gone");
  });

  it("extending defaultOverrides turns one override back on without losing the rest", async () => {
    const optimize = svgo({
      plugins: [
        {
          name: "preset-default",
          params: {
            overrides: { ...defaultOverrides, convertColors: { currentColor: true } },
          },
        },
      ],
    });
    const out = await optimize(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><!-- kept --><path fill="#000000" d="M1 2L3 4" /></svg>',
      ctx,
    );
    expect(out).toContain('fill="currentColor"');
    expect(out).toContain("kept");
  });
});
