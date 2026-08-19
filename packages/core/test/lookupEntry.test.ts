import { afterEach, describe, expect, it, vi } from "vitest";

const getEntry = vi.fn();
vi.mock("astro:content", () => ({ getEntry: (...args: unknown[]) => getEntry(...args) }));

const { resolveIconEntry } = await import("../src/render/lookupEntry.js");

afterEach(() => {
  getEntry.mockReset();
});

describe("resolveIconEntry", () => {
  it("returns the exact-name entry without a fallback lookup", async () => {
    const entry = { data: { body: "<path/>" } };
    getEntry.mockResolvedValueOnce(entry);

    await expect(resolveIconEntry("local", "deno")).resolves.toBe(entry);
    expect(getEntry).toHaveBeenCalledOnce();
    expect(getEntry).toHaveBeenCalledWith("local", "deno");
  });

  it("falls back to a lowercase-normalized name when the exact name misses (#189)", async () => {
    const entry = { data: { body: "<path/>" } };
    getEntry.mockResolvedValueOnce(undefined).mockResolvedValueOnce(entry);

    await expect(resolveIconEntry("local", "Deno")).resolves.toBe(entry);
    expect(getEntry).toHaveBeenNthCalledWith(1, "local", "Deno");
    expect(getEntry).toHaveBeenNthCalledWith(2, "local", "deno");
  });

  it("warns in dev when the fallback is what matched", async () => {
    const entry = { data: { body: "<path/>" } };
    getEntry.mockResolvedValueOnce(undefined).mockResolvedValueOnce(entry);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await resolveIconEntry("local", "Deno");

    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/"Deno".*"local".*"deno"/),
    );
    warn.mockRestore();
  });

  it("doesn't retry when the name is already lowercase", async () => {
    getEntry.mockResolvedValueOnce(undefined);

    await expect(resolveIconEntry("local", "deno")).resolves.toBeUndefined();
    expect(getEntry).toHaveBeenCalledOnce();
  });

  it("returns undefined when neither the exact nor lowercase name resolves", async () => {
    getEntry.mockResolvedValue(undefined);

    await expect(
      resolveIconEntry("local", "NotReal"),
    ).resolves.toBeUndefined();
  });

  it("swallows a getEntry rejection as a miss", async () => {
    getEntry.mockRejectedValue(new Error("boom"));

    await expect(resolveIconEntry("local", "deno")).resolves.toBeUndefined();
  });
});
