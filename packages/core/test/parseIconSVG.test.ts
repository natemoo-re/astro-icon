import { describe, expect, it, vi } from "vitest";
import { parseIconSVG } from "../src/content/parseIconSVG.js";

function warnLogger() {
  return { warn: vi.fn() };
}

describe("parseIconSVG / malformed optimize output", () => {
  it("throws a descriptive error when optimize returns markup with no <svg> element", async () => {
    await expect(
      parseIconSVG("<path d='M0 0h24v24H0z'/>", {
        collection: "mdi",
        name: "home",
        optimize: async () => "<path d='M0 0h24v24H0z'/>",
        logger: warnLogger(),
      }),
    ).rejects.toThrow(/no <svg> element/i);
  });

  it("throws when optimize returns an empty string", async () => {
    await expect(
      parseIconSVG("<svg viewBox='0 0 24 24'></svg>", {
        collection: "mdi",
        name: "home",
        optimize: async () => "",
        logger: warnLogger(),
      }),
    ).rejects.toThrow(/no <svg> element/i);
  });

  it("doesn't throw for a well-formed self-closing <svg> element", async () => {
    await expect(
      parseIconSVG("<svg viewBox='0 0 24 24'/>", {
        collection: "mdi",
        name: "home",
        logger: warnLogger(),
      }),
    ).resolves.toMatchObject({ viewBox: "0 0 24 24" });
  });
});

describe("parseIconSVG / malformed viewBox", () => {
  it("falls back to a derived viewBox, with a warning, when viewBox has non-numeric values", async () => {
    const warn = vi.fn();
    await expect(
      parseIconSVG("<svg viewBox='0 0 NaN NaN' width='32' height='32'></svg>", {
        collection: "mdi",
        name: "home",
        logger: { warn },
      }),
    ).resolves.toMatchObject({ viewBox: "0 0 32 32", width: 32, height: 32 });
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/invalid viewBox/i),
    );
  });

  it("falls back to a derived viewBox, with a warning, when viewBox has too few tokens", async () => {
    const warn = vi.fn();
    await expect(
      parseIconSVG("<svg viewBox='0 0 24'></svg>", {
        collection: "mdi",
        name: "home",
        logger: { warn },
      }),
    ).resolves.toMatchObject({ viewBox: "0 0 24 24" });
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/invalid viewBox/i),
    );
  });

  it("throws under strict instead of falling back", async () => {
    await expect(
      parseIconSVG("<svg viewBox='0 0 NaN NaN'></svg>", {
        collection: "mdi",
        name: "home",
        strict: true,
        logger: warnLogger(),
      }),
    ).rejects.toThrow(/invalid viewBox/i);
  });

  it("doesn't throw or warn for a well-formed viewBox", async () => {
    const warn = vi.fn();
    await expect(
      parseIconSVG("<svg viewBox='0 0 24 24'></svg>", {
        collection: "mdi",
        name: "home",
        logger: { warn },
      }),
    ).resolves.toMatchObject({ viewBox: "0 0 24 24", width: 24, height: 24 });
    expect(warn).not.toHaveBeenCalled();
  });
});

const context = { collection: "icons", name: "glyph", logger: warnLogger() };

describe("parseIconSVG", () => {
  it("carries the root's presentation attributes onto a wrapping <g>", async () => {
    // The Heroicons/Feather/Lucide shape: everything about how the icon paints lives on
    // the root, so dropping it renders a solid black shape instead of a stroked outline.
    const entry = await parseIconSVG(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-7 9 7" /></svg>`,
      context,
    );

    expect(entry.body).toBe(
      `<g fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-7 9 7" /></g>`,
    );
    expect(entry.viewBox).toBe("0 0 24 24");
  });

  it("keeps currentColor reachable so the icon still responds to CSS color", async () => {
    const entry = await parseIconSVG(
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M0 0h24" /></svg>`,
      context,
    );

    expect(entry.body).toContain("currentColor");
  });

  it("leaves a body with no root presentation attributes byte-identical", async () => {
    // An Iconify-shaped body paints entirely through its own children; wrapping it in a
    // <g> that carries nothing would add bytes to every icon for no behavioral gain.
    const body = `<path d="M10 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12z"/>`;
    const entry = await parseIconSVG(`<svg viewBox="0 0 24 24">${body}</svg>`, context);

    expect(entry.body).toBe(body);
  });

  it("does not carry attributes that describe the element rather than its painting", async () => {
    // `class` would leak an author's sizing utilities onto the body; width/height/xmlns
    // describe the root being replaced, and <Icon> sets its own.
    const entry = await parseIconSVG(
      `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" id="root" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="red"><path d="M0 0h24" /></svg>`,
      context,
    );

    expect(entry.body).toBe(`<g fill="none" stroke="red"><path d="M0 0h24" /></g>`);
  });

  it("lets a child's own attribute win over the carried root value", async () => {
    // Inheritance, not hoisting: the group supplies a default the child can still override,
    // which is exactly what the original root <svg> did.
    const entry = await parseIconSVG(
      `<svg viewBox="0 0 24 24" fill="none"><path fill="red" d="M0 0h24" /></svg>`,
      context,
    );

    expect(entry.body).toBe(`<g fill="none"><path fill="red" d="M0 0h24" /></g>`);
  });

  it("reads single-quoted root attributes", async () => {
    const entry = await parseIconSVG(
      `<svg viewBox='0 0 24 24' stroke='currentColor'><path d="M0 0h24" /></svg>`,
      context,
    );

    expect(entry.body).toBe(`<g stroke="currentColor"><path d="M0 0h24" /></g>`);
  });

  it("leaves an empty body alone", async () => {
    const entry = await parseIconSVG(
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"></svg>`,
      context,
    );

    expect(entry.body).toBe("");
  });

  it("keeps a source-authored title/desc out of the carried <g>", async () => {
    const entry = await parseIconSVG(
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><title>Adjustment</title><desc>Sliders</desc><path d="M0 0h24" /></svg>`,
      context,
    );

    expect(entry.body).toBe(
      `<title>Adjustment</title><desc>Sliders</desc><g fill="none" stroke="currentColor"><path d="M0 0h24" /></g>`,
    );
  });

  it("carries attributes through an optimize pass, which runs first", async () => {
    const optimize = vi.fn(async (svg: string) => svg.replace("blue", "green"));
    const entry = await parseIconSVG(
      `<svg viewBox="0 0 24 24" stroke="blue"><path d="M0 0h24" /></svg>`,
      { ...context, optimize },
    );

    expect(entry.body).toBe(`<g stroke="green"><path d="M0 0h24" /></g>`);
  });
});
