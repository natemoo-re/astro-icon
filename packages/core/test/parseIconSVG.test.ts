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
  // Regression: a present-but-malformed viewBox (wrong token count, non-numeric values) used to
  // produce NaN width/height with no error at all here - Zod's iconEntrySchema does reject a NaN
  // width/height, but only once the entry reaches Astro's own parseData, well past buildIcons'
  // per-icon try/catch, crashing the whole sync uncaught instead of respecting "strict".
  it("falls back to a derived viewBox, with a warning, when viewBox has non-numeric values", async () => {
    const warn = vi.fn();
    await expect(
      parseIconSVG("<svg viewBox='0 0 NaN NaN' width='32' height='32'></svg>", {
        collection: "mdi",
        name: "home",
        logger: { warn },
      }),
    ).resolves.toMatchObject({ viewBox: "0 0 32 32", width: 32, height: 32 });
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/invalid viewBox/i));
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
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/invalid viewBox/i));
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
