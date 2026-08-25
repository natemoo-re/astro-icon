import { describe, expect, it } from "vitest";
import { entryFromSVG } from "../src/content/ingest/entryFromSVG.js";

describe("entryFromSVG / no <svg> element", () => {
  it("throws when the markup has no <svg> element at all", () => {
    expect(() => entryFromSVG("<path d='M0 0h24v24H0z'/>")).toThrow(/<svg>/i);
  });

  it("throws for an empty string", () => {
    expect(() => entryFromSVG("")).toThrow(/<svg>/i);
  });

  it("doesn't throw for a well-formed self-closing <svg> element", () => {
    expect(() => entryFromSVG("<svg viewBox='0 0 24 24'/>")).not.toThrow();
  });
});

describe("entryFromSVG / viewBox facts", () => {
  it("reports 'present' and uses it as-is when the viewBox parses to four numbers", () => {
    const { entry, facts } = entryFromSVG(
      `<svg viewBox="0 0 32 32"><path d="M0 0"/></svg>`,
    );
    expect(facts.viewBox).toBe("present");
    expect(entry).toMatchObject({
      viewBox: "0 0 32 32",
      width: 32,
      height: 32,
    });
  });

  it("reports 'missing' and recovers one from unit-less width/height when the viewBox is absent", () => {
    const { entry, facts } = entryFromSVG(
      `<svg width="20" height="20"><path d="M0 0"/></svg>`,
    );
    expect(facts.viewBox).toBe("missing");
    expect(entry).toMatchObject({
      viewBox: "0 0 20 20",
      width: 20,
      height: 20,
    });
  });

  it("reports 'missing' when the viewBox has too few tokens", () => {
    const { facts } = entryFromSVG(
      `<svg viewBox="0 0 24" width="24" height="24"><path d="M0 0"/></svg>`,
    );
    expect(facts.viewBox).toBe("missing");
  });

  it("reports 'missing' when the viewBox has non-numeric values", () => {
    const { facts } = entryFromSVG(
      `<svg viewBox="0 0 NaN NaN" width="24" height="24"><path d="M0 0"/></svg>`,
    );
    expect(facts.viewBox).toBe("missing");
  });

  it("doesn't recover from a unit-suffixed width/height (e.g. '1em'), using the 24x24 default", () => {
    const { facts, entry } = entryFromSVG(
      `<svg width="1em" height="1em"><path d="M0 0"/></svg>`,
    );
    expect(facts.viewBox).toBe("missing");
    expect(entry).toMatchObject({
      viewBox: "0 0 24 24",
      width: 24,
      height: 24,
    });
  });

  it("falls back to 0 0 24 24 with neither viewBox nor width/height", () => {
    const { entry, facts } = entryFromSVG(`<svg><path d="M0 0"/></svg>`);
    expect(facts.viewBox).toBe("missing");
    expect(entry).toMatchObject({
      viewBox: "0 0 24 24",
      width: 24,
      height: 24,
    });
  });
});

describe("entryFromSVG / root attribute lifting", () => {
  it("lifts non-structural root attributes onto the entry", () => {
    const { entry } = entryFromSVG(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M0 0"/></svg>`,
    );
    expect(entry).toMatchObject({ fill: "none", stroke: "currentColor" });
    expect(entry.xmlns).toBeUndefined();
  });

  it("skips xmlns/xmlns:xlink/version/viewBox/width/height", () => {
    const { entry } = entryFromSVG(
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" viewBox="0 0 24 24" width="24" height="24"><path d="M0 0"/></svg>`,
    );
    expect(entry).toEqual({
      body: '<path d="M0 0" />',
      viewBox: "0 0 24 24",
      width: 24,
      height: 24,
    });
  });

  it("skips role/aria-*/focusable/tabindex", () => {
    const { entry } = entryFromSVG(
      `<svg viewBox="0 0 24 24" aria-hidden="true" role="img" focusable="false" tabindex="-1" fill="currentColor"><path d="M0 0"/></svg>`,
    );
    expect(entry).toMatchObject({ fill: "currentColor" });
    expect(entry.role).toBeUndefined();
    expect(entry["aria-hidden"]).toBeUndefined();
    expect(entry.focusable).toBeUndefined();
    expect(entry.tabindex).toBeUndefined();
  });

  it("keeps any other attribute (class, style, id, ...)", () => {
    const { entry } = entryFromSVG(
      `<svg viewBox="0 0 24 24" class="h-6 w-6" style="opacity:.5" id="icon"><path d="M0 0"/></svg>`,
    );
    expect(entry).toMatchObject({
      class: "h-6 w-6",
      style: "opacity:.5",
      id: "icon",
    });
  });

  it("does not carry root attributes onto an inner <g> - they land only on the entry", () => {
    const { entry } = entryFromSVG(
      `<svg viewBox="0 0 24 24" fill="none" stroke="#000"><path d="M0 0"/></svg>`,
    );
    expect(entry.body).toBe('<path d="M0 0" />');
  });

  it("spreads lifted root attrs first, so a stray one can't shadow a real entry field", () => {
    const { entry } = entryFromSVG(
      `<svg viewBox="0 0 24 24" body="nope"><path d="M0 0"/></svg>`,
    );
    expect(entry.body).toBe('<path d="M0 0" />');
  });
});

describe("entryFromSVG / title and desc", () => {
  it("lifts the first <title> and strips it from body", () => {
    const { entry } = entryFromSVG(
      `<svg viewBox="0 0 24 24"><title>Adjustment</title><path d="M0 0"/></svg>`,
    );
    expect(entry).toMatchObject({ title: "Adjustment" });
    expect(entry.body).toBe('<path d="M0 0" />');
  });

  it("lifts the first <desc> and strips it from body", () => {
    const { entry } = entryFromSVG(
      `<svg viewBox="0 0 24 24"><desc>An adjustment icon</desc><path d="M0 0"/></svg>`,
    );
    expect(entry).toMatchObject({ desc: "An adjustment icon" });
    expect(entry.body).toBe('<path d="M0 0" />');
  });

  it("lifts both when present", () => {
    const { entry } = entryFromSVG(
      `<svg viewBox="0 0 24 24"><title>Adjustment</title><desc>An adjustment icon</desc><path d="M0 0"/></svg>`,
    );
    expect(entry).toMatchObject({
      title: "Adjustment",
      desc: "An adjustment icon",
    });
  });

  it("leaves a <title> nested inside a <g> alone - it labels the group, not the icon", () => {
    const { entry } = entryFromSVG(
      `<svg viewBox="0 0 24 24"><g><title>Group label</title><path d="M0 0"/></g></svg>`,
    );
    expect("title" in entry).toBe(false);
    expect(entry.body).toContain("<title>Group label</title>");
  });

  it("leaves title/desc unset when absent", () => {
    const { entry } = entryFromSVG(
      `<svg viewBox="0 0 24 24"><path d="M0 0"/></svg>`,
    );
    expect("title" in entry).toBe(false);
    expect("desc" in entry).toBe(false);
  });

  it("treats an empty <title>/<desc> as absent", () => {
    const { entry } = entryFromSVG(
      `<svg viewBox="0 0 24 24"><title></title><path d="M0 0"/></svg>`,
    );
    expect("title" in entry).toBe(false);
  });

  it("trims whitespace around the extracted text", () => {
    const { entry } = entryFromSVG(
      `<svg viewBox="0 0 24 24"><title>\n  Adjustment  \n</title><path d="M0 0"/></svg>`,
    );
    expect(entry.title).toBe("Adjustment");
  });

  it("lifts a <title>/<desc> found anywhere in the body, not just leading position", () => {
    const { entry } = entryFromSVG(
      `<svg viewBox="0 0 24 24"><path d="M0 0"/><title>Late title</title></svg>`,
    );
    expect(entry.title).toBe("Late title");
    expect(entry.body).toBe('<path d="M0 0" />');
  });
});

describe("entryFromSVG / currentColor facts", () => {
  it("is false when the icon already uses currentColor in body", () => {
    const { facts } = entryFromSVG(
      `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M0 0"/></svg>`,
    );
    expect(facts.monochromeWithoutCurrentColor).toBe(false);
  });

  it("is false when currentColor is set on the root <svg> tag", () => {
    const { facts } = entryFromSVG(
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M0 0"/></svg>`,
    );
    expect(facts.monochromeWithoutCurrentColor).toBe(false);
  });

  it("is true for a shape with no explicit fill/stroke at all", () => {
    const { facts } = entryFromSVG(
      `<svg viewBox="0 0 24 24"><path d="M0 0"/></svg>`,
    );
    expect(facts.monochromeWithoutCurrentColor).toBe(true);
  });

  it("is true for a single explicit color used consistently", () => {
    const { facts } = entryFromSVG(
      `<svg viewBox="0 0 24 24"><path fill="#000" d="M0 0"/><path fill="#000" d="M1 1"/></svg>`,
    );
    expect(facts.monochromeWithoutCurrentColor).toBe(true);
  });

  it("is false for two or more distinct explicit colors", () => {
    const { facts } = entryFromSVG(
      `<svg viewBox="0 0 24 24"><path fill="#ff0000" d="M0 0"/><path fill="#0000ff" d="M1 1"/></svg>`,
    );
    expect(facts.monochromeWithoutCurrentColor).toBe(false);
  });

  it('ignores fill="none"/stroke="none" when counting distinct colors', () => {
    const { facts } = entryFromSVG(
      `<svg viewBox="0 0 24 24"><path fill="none" stroke="#000" d="M0 0"/></svg>`,
    );
    expect(facts.monochromeWithoutCurrentColor).toBe(true);
  });
});

describe("entryFromSVG / sanitize", () => {
  it("removes a <script> element from body", () => {
    const { entry } = entryFromSVG(
      `<svg viewBox="0 0 24 24"><path d="M0 0"/><script>alert(1)</script></svg>`,
    );
    expect(entry.body).toBe('<path d="M0 0" />');
  });

  it("removes a <foreignObject> element from body", () => {
    const { entry } = entryFromSVG(
      `<svg viewBox="0 0 24 24"><foreignObject><div onclick="x()">hi</div></foreignObject><path d="M0 0"/></svg>`,
    );
    expect(entry.body).toBe('<path d="M0 0" />');
  });

  it("strips on* attributes but keeps the element", () => {
    const { entry } = entryFromSVG(
      `<svg viewBox="0 0 24 24"><path d="M0 0" onload="alert(1)"/></svg>`,
    );
    expect(entry.body).toBe('<path d="M0 0" />');
  });

  it("strips a javascript: URI from href", () => {
    const { entry } = entryFromSVG(
      `<svg viewBox="0 0 24 24"><a href="javascript:alert(1)">x</a></svg>`,
    );
    expect(entry.body).toBe("<a>x</a>");
  });
});

describe("entryFromSVG / merge order", () => {
  it("puts body/viewBox/width/height/title/desc last, so root attrs never shadow them", () => {
    const { entry } = entryFromSVG(
      `<svg viewBox="0 0 24 24" title="stray"><title>Real</title><path d="M0 0"/></svg>`,
    );
    // The root's own (skipped-nothing, since "title" isn't in the skip list) attribute value
    // is overwritten by the lifted <title> element - the entry field wins.
    expect(entry.title).toBe("Real");
  });
});
