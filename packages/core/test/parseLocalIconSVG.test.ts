import { describe, expect, it, vi } from "vitest";
import { parseLocalIconSVG } from "../src/content/local/parseLocalIconSVG.js";

const logger = { warn: vi.fn() };

function parse(svg: string, options: { optimize?: never } = {}) {
  return parseLocalIconSVG(svg, { name: "icon", logger, ...options });
}

function svgWith(attrs: string, body = '<path d="M0 0"/>'): string {
  return `<svg viewBox="0 0 24 24"${attrs ? ` ${attrs}` : ""}>${body}</svg>`;
}

describe("parseLocalIconSVG / root attributes", () => {
  it("reads the root tag's non-structural attributes onto the entry", async () => {
    const { entry } = await parse(
      '<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M0 0"/></svg>',
    );
    expect(entry).toMatchObject({ fill: "none", stroke: "currentColor" });
    expect(entry.xmlns).toBeUndefined();
  });

  it("drops xmlns/xmlns:xlink/version/viewBox/width/height, handled elsewhere", async () => {
    const { entry } = await parse(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" viewBox="0 0 24 24" width="24" height="24"><path d="M0 0"/></svg>',
    );
    // `viewBox`/`width`/`height` come from the parse, not the raw attribute copy.
    expect(entry).toEqual({
      body: '<path d="M0 0"/>',
      viewBox: "0 0 24 24",
      width: 24,
      height: 24,
    });
  });

  it("keeps any attribute, not just color-related ones (class, style, id, ...)", async () => {
    const { entry } = await parse(
      svgWith('class="h-6 w-6" style="opacity:.5" id="icon"'),
    );
    expect(entry).toMatchObject({
      class: "h-6 w-6",
      style: "opacity:.5",
      id: "icon",
    });
  });

  it("drops role/aria-*/focusable/tabindex - <Icon>'s own a11y contract owns those, not the source file's", async () => {
    const { entry } = await parse(
      svgWith(
        'aria-hidden="true" role="img" focusable="false" tabindex="-1" fill="currentColor"',
      ),
    );
    expect(entry).toMatchObject({ fill: "currentColor" });
    expect(entry.role).toBeUndefined();
    expect(entry["aria-hidden"]).toBeUndefined();
    expect(entry.focusable).toBeUndefined();
    expect(entry.tabindex).toBeUndefined();
  });

  it("keeps root attributes out of body rather than carrying them onto an inner <g>", async () => {
    // Carrying them would put the source's colors on an element whose own value beats a
    // caller's `<Icon fill="red" />` landing on the outer `<svg>`.
    const { entry } = await parse(svgWith('fill="none" stroke="#000"'));
    expect(entry.body).toBe('<path d="M0 0"/>');
  });

  it("can't let a stray root attribute shadow a real entry field", async () => {
    const { entry } = await parse(svgWith('body="nope"'));
    expect(entry.body).toBe('<path d="M0 0"/>');
  });
});

describe("parseLocalIconSVG / title and desc", () => {
  it("extracts a <title> and strips it from body", async () => {
    const { entry } = await parse(
      svgWith("", '<title>Adjustment</title><path d="M0 0"/>'),
    );
    expect(entry).toMatchObject({
      title: "Adjustment",
      body: '<path d="M0 0"/>',
    });
  });

  it("extracts a <desc> and strips it from body", async () => {
    const { entry } = await parse(
      svgWith("", '<desc>An adjustment icon</desc><path d="M0 0"/>'),
    );
    expect(entry).toMatchObject({
      desc: "An adjustment icon",
      body: '<path d="M0 0"/>',
    });
  });

  it("extracts both when present", async () => {
    const { entry } = await parse(
      svgWith(
        "",
        '<title>Adjustment</title><desc>An adjustment icon</desc><path d="M0 0"/>',
      ),
    );
    expect(entry).toMatchObject({
      title: "Adjustment",
      desc: "An adjustment icon",
      body: '<path d="M0 0"/>',
    });
  });

  it("leaves body as-is, with neither key set, when there's no <title>/<desc>", async () => {
    const { entry } = await parse(svgWith(""));
    expect(entry.body).toBe('<path d="M0 0"/>');
    expect("title" in entry).toBe(false);
    expect("desc" in entry).toBe(false);
  });

  it("treats an empty <title>/<desc> as absent, not an empty string", async () => {
    const { entry } = await parse(
      svgWith("", '<title></title><path d="M0 0"/>'),
    );
    expect("title" in entry).toBe(false);
    expect(entry.body).toBe('<path d="M0 0"/>');
  });

  it("trims whitespace around the extracted text", async () => {
    const { entry } = await parse(
      svgWith("", '<title>\n  Adjustment  \n</title><path d="M0 0"/>'),
    );
    expect(entry.title).toBe("Adjustment");
  });
});

describe("parseLocalIconSVG / currentColor hint", () => {
  it("is false when the icon already uses currentColor", async () => {
    const { needsCurrentColor } = await parse(
      svgWith("", '<path fill="currentColor" d="M0 0"/>'),
    );
    expect(needsCurrentColor).toBe(false);
  });

  it("is false when currentColor is used anywhere, even alongside other colors", async () => {
    const { needsCurrentColor } = await parse(
      svgWith(
        "",
        '<path fill="currentColor" d="M0 0"/><path fill="#ff0000" d="M1 1"/>',
      ),
    );
    expect(needsCurrentColor).toBe(false);
  });

  it("is true for a shape with no explicit fill/stroke at all (relies on default black)", async () => {
    const { needsCurrentColor } = await parse(svgWith(""));
    expect(needsCurrentColor).toBe(true);
  });

  it("is true for a single explicit color used consistently", async () => {
    const { needsCurrentColor } = await parse(
      svgWith("", '<path fill="#000" d="M0 0"/><path fill="#000" d="M1 1"/>'),
    );
    expect(needsCurrentColor).toBe(true);
  });

  it("is false for two or more distinct explicit colors (reads as a deliberate multi-color graphic)", async () => {
    const { needsCurrentColor } = await parse(
      svgWith(
        "",
        '<path fill="#ff0000" d="M0 0"/><path fill="#0000ff" d="M1 1"/>',
      ),
    );
    expect(needsCurrentColor).toBe(false);
  });

  it('ignores fill="none"/stroke="none" when counting distinct colors', async () => {
    const { needsCurrentColor } = await parse(
      svgWith("", '<path fill="none" stroke="#000" d="M0 0"/>'),
    );
    expect(needsCurrentColor).toBe(true);
  });

  it("is case-insensitive for currentColor", async () => {
    const { needsCurrentColor } = await parse(
      svgWith("", '<path fill="CURRENTCOLOR" d="M0 0"/>'),
    );
    expect(needsCurrentColor).toBe(false);
  });

  it("is false when currentColor is set on the root <svg> tag itself", async () => {
    // Only reachable because the root attributes are extracted before this runs.
    const { needsCurrentColor } = await parse(
      svgWith('fill="none" stroke="currentColor"'),
    );
    expect(needsCurrentColor).toBe(false);
  });

  it("judges the post-strip body, not the source's <title>/<desc> text", async () => {
    const { needsCurrentColor } = await parse(
      svgWith("", '<desc>currentColor</desc><path d="M0 0"/>'),
    );
    expect(needsCurrentColor).toBe(true);
  });
});

describe("parseLocalIconSVG / optimize ordering", () => {
  it("extracts root attributes from the optimized markup, not the original", async () => {
    const { entry } = await parseLocalIconSVG(svgWith('fill="#000"'), {
      name: "icon",
      logger,
      optimize: (svg) => svg.replace('fill="#000"', 'fill="currentColor"'),
    });
    expect(entry.fill).toBe("currentColor");
  });

  it("judges the currentColor hint against the optimized markup too", async () => {
    const { needsCurrentColor } = await parseLocalIconSVG(
      svgWith("", '<path fill="#000" d="M0 0"/>'),
      {
        name: "icon",
        logger,
        optimize: (svg) => svg.replaceAll('fill="#000"', 'fill="currentColor"'),
      },
    );
    expect(needsCurrentColor).toBe(false);
  });

  it("passes the local collection name to optimize", async () => {
    const optimize = vi.fn((svg: string) => svg);
    await parseLocalIconSVG(svgWith(""), {
      name: "logos/deno",
      logger,
      optimize,
    });
    expect(optimize).toHaveBeenCalledWith(expect.any(String), {
      collection: "local",
      name: "logos/deno",
    });
  });
});
