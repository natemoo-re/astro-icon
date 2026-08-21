import { describe, expect, it } from "vitest";
import { extractTitleDesc } from "../src/content/local/extractTitleDesc.js";

describe("extractTitleDesc", () => {
  it("extracts a <title> and strips it from body", () => {
    expect(
      extractTitleDesc('<title>Adjustment</title><path d="M0 0"/>'),
    ).toEqual({ title: "Adjustment", body: '<path d="M0 0"/>' });
  });

  it("extracts a <desc> and strips it from body", () => {
    expect(
      extractTitleDesc('<desc>An adjustment icon</desc><path d="M0 0"/>'),
    ).toEqual({ desc: "An adjustment icon", body: '<path d="M0 0"/>' });
  });

  it("extracts both when present", () => {
    expect(
      extractTitleDesc(
        '<title>Adjustment</title><desc>An adjustment icon</desc><path d="M0 0"/>',
      ),
    ).toEqual({
      title: "Adjustment",
      desc: "An adjustment icon",
      body: '<path d="M0 0"/>',
    });
  });

  it("leaves body as-is, with neither key set, when there's no <title>/<desc>", () => {
    expect(extractTitleDesc('<path d="M0 0"/>')).toEqual({
      body: '<path d="M0 0"/>',
    });
  });

  it("treats an empty <title>/<desc> as absent, not an empty string", () => {
    expect(extractTitleDesc('<title></title><path d="M0 0"/>')).toEqual({
      body: '<path d="M0 0"/>',
    });
  });

  it("trims whitespace around the extracted text", () => {
    expect(
      extractTitleDesc('<title>\n  Adjustment  \n</title><path d="M0 0"/>'),
    ).toEqual({ title: "Adjustment", body: '<path d="M0 0"/>' });
  });
});
