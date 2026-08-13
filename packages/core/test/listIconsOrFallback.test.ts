import { describe, expect, it, vi } from "vitest";
import { AstroIconError } from "../src/internal/error.js";
import { listIconsOrFallback } from "../src/content/listIconsOrFallback.js";

function options(overrides: Partial<Parameters<typeof listIconsOrFallback>[1]> = {}) {
  return {
    strict: false,
    logger: { warn: vi.fn() },
    failureMessage: (detail: string) => `failed: ${detail}`,
    hint: "fix it",
    ...overrides,
  };
}

describe("listIconsOrFallback", () => {
  it("falls back to an empty list when the source has no listIcons()", async () => {
    const names = await listIconsOrFallback({}, options());
    expect(names).toEqual([]);
  });

  it("returns whatever listIcons() resolves to", async () => {
    const names = await listIconsOrFallback(
      { listIcons: async () => ["a", "b"] },
      options(),
    );
    expect(names).toEqual(["a", "b"]);
  });

  it("warns and falls back to [] when listIcons() throws and strict is off", async () => {
    const logger = { warn: vi.fn() };
    const names = await listIconsOrFallback(
      {
        listIcons: async () => {
          throw new Error("boom");
        },
      },
      options({ logger, strict: false }),
    );
    expect(names).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith("failed: boom");
  });

  it("throws an AstroIconError when listIcons() throws and strict is on", async () => {
    await expect(
      listIconsOrFallback(
        {
          listIcons: async () => {
            throw new Error("boom");
          },
        },
        options({ strict: true }),
      ),
    ).rejects.toBeInstanceOf(AstroIconError);
  });
});
