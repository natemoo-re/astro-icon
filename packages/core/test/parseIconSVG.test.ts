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
