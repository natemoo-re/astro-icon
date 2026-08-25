import type { IconifyJSON } from "@iconify/types";
import { describe, expect, it } from "vitest";
import { entryFromIconifyData } from "../src/content/ingest/entryFromIconifyData.js";

const search: IconifyJSON = {
  prefix: "mdi",
  icons: {
    search: {
      body: '<path d="M10 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12z"/>',
      width: 24,
      height: 24,
    },
  },
};

const pack: IconifyJSON = {
  prefix: "mixed",
  icons: {
    // The plain case: a viewBox-sized icon with no transforms.
    search: {
      body: '<path d="M10 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12z"/>',
      width: 24,
      height: 24,
    },
    // A non-default intrinsic size.
    small: {
      body: '<circle cx="8" cy="8" r="4"/>',
      width: 16,
      height: 16,
    },
    // Multiple paths/elements in one body.
    multiPath: {
      body: '<path d="M0 0h24v24H0z" fill="none"/><path d="M12 2 2 22h20z"/>',
      width: 24,
      height: 24,
    },
    // A non-zero left/top box, distinct width/height, and a rotation - exercises `iconToSVG`'s
    // own transform wrapping (a <g transform="..."> around body) and non-"0 0" viewBox origin.
    rotated: {
      body: '<path d="M4 4h8v8H4z"/>',
      left: 2,
      top: 1,
      width: 20,
      height: 12,
      rotate: 1,
    },
  },
  aliases: {
    magnify: { parent: "search" },
  },
};

describe("entryFromIconifyData", () => {
  it("uses the source viewBox and body verbatim", () => {
    const entry = entryFromIconifyData(search, "search");
    expect(entry).toEqual({
      body: '<path d="M10 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12z"/>',
      viewBox: "0 0 24 24",
      width: 24,
      height: 24,
    });
  });

  it("returns undefined for an icon that doesn't exist", () => {
    expect(entryFromIconifyData(search, "missing")).toBeUndefined();
  });

  it("resolves an aliased name", () => {
    const entry = entryFromIconifyData(pack, "magnify");
    expect(entry).toEqual(entryFromIconifyData(pack, "search"));
  });

  for (const name of ["search", "small", "multiPath", "rotated"]) {
    it(`builds a well-formed entry for "${name}"`, () => {
      const entry = entryFromIconifyData(pack, name);
      expect(entry).toMatchObject({
        body: expect.any(String),
        viewBox: expect.stringMatching(
          /^-?\d+(\.\d+)? -?\d+(\.\d+)? \d+(\.\d+)? \d+(\.\d+)?$/,
        ),
        width: expect.any(Number),
        height: expect.any(Number),
      });
    });
  }

  it("carries a non-zero box origin and applies the rotate transform through iconToSVG", () => {
    const entry = entryFromIconifyData(pack, "rotated");
    // Rotated 90deg: iconToSVG swaps width/height and wraps body in a <g transform="rotate(...)">.
    expect(entry?.viewBox).toBe("1 2 12 20");
    expect(entry?.width).toBe(12);
    expect(entry?.height).toBe(20);
    expect(entry?.body).toContain("<g transform=");
    expect(entry?.body).toContain('<path d="M4 4h8v8H4z"/>');
  });
});
