import { describe, expect, it, vi } from "vitest";
import { AstroIconError } from "../src/internal/error.js";
import { listIconsOrFallback } from "../src/content/listIconsOrFallback.js";

function options(
  overrides: Partial<Parameters<typeof listIconsOrFallback>[1]> = {},
) {
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

  it("calls checkPreconditions() before listIcons(), warning and falling back to [] when it throws", async () => {
    const logger = { warn: vi.fn() };
    const listIcons = vi.fn(async () => ["a"]);
    const names = await listIconsOrFallback(
      {
        listIcons,
        checkPreconditions: async () => {
          throw new Error("not installed");
        },
      },
      options({ logger }),
    );
    expect(names).toEqual([]);
    expect(listIcons).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith("failed: not installed");
  });

  it("throws an AstroIconError when checkPreconditions() throws and strict is on, without calling listIcons()", async () => {
    const listIcons = vi.fn(async () => ["a"]);
    await expect(
      listIconsOrFallback(
        {
          listIcons,
          checkPreconditions: async () => {
            throw new Error("not installed");
          },
        },
        options({ strict: true }),
      ),
    ).rejects.toBeInstanceOf(AstroIconError);
    expect(listIcons).not.toHaveBeenCalled();
  });

  it("calls listIcons() normally once checkPreconditions() succeeds", async () => {
    const names = await listIconsOrFallback(
      {
        listIcons: async () => ["a", "b"],
        checkPreconditions: async () => {},
      },
      options(),
    );
    expect(names).toEqual(["a", "b"]);
  });
});
