import { afterEach, describe, expect, it, vi } from "vitest";

const getEntry = vi.fn();
const getCollection = vi.fn();
vi.mock("astro:content", () => ({
  getEntry: (...args: unknown[]) => getEntry(...args),
  getCollection: (...args: unknown[]) => getCollection(...args),
}));

const { resolveIconEntry } = await import("../src/render/lookupEntry.js");

afterEach(() => {
  getEntry.mockReset();
  getCollection.mockReset();
});

/** Fakes `getCollection`'s real filtering behavior, for a fallback test to run its own filter against. */
function fakeCollection(entries: { id: string; data: { body: string } }[]) {
  getCollection.mockImplementation(
    async (_collection: string, filter?: (entry: unknown) => boolean) =>
      filter ? entries.filter(filter) : entries,
  );
}

describe("resolveIconEntry", () => {
  it("returns the exact-name entry without a fallback lookup", async () => {
    const entry = { data: { body: "<path/>" } };
    getEntry.mockResolvedValueOnce(entry);

    await expect(resolveIconEntry("local", "deno")).resolves.toBe(entry);
    expect(getEntry).toHaveBeenCalledOnce();
    expect(getEntry).toHaveBeenCalledWith("local", "deno");
    expect(getCollection).not.toHaveBeenCalled();
  });

  it("falls back case-insensitively when the request is capitalized but the entry isn't (#189)", async () => {
    const entry = { id: "logos/deno", data: { body: "<path/>" } };
    getEntry.mockResolvedValueOnce(undefined);
    fakeCollection([entry]);

    await expect(
      resolveIconEntry("local", "logos/Deno"),
    ).resolves.toMatchObject({ data: entry.data });
    expect(getCollection).toHaveBeenCalledWith("local", expect.any(Function));
  });

  it("falls back case-insensitively when the entry is capitalized but the request isn't (#189)", async () => {
    const entry = { id: "logos/Deno", data: { body: "<path/>" } };
    getEntry.mockResolvedValueOnce(undefined);
    fakeCollection([entry]);

    await expect(
      resolveIconEntry("local", "logos/deno"),
    ).resolves.toMatchObject({ data: entry.data });
  });

  it("warns in dev when the fallback is what matched", async () => {
    const entry = { id: "logos/Deno", data: { body: "<path/>" } };
    getEntry.mockResolvedValueOnce(undefined);
    fakeCollection([entry]);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await resolveIconEntry("local", "logos/deno");

    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/"logos\/deno".*"local".*"logos\/Deno"/),
    );
    warn.mockRestore();
  });

  it("returns undefined when neither the exact nor case-insensitive match resolves", async () => {
    getEntry.mockResolvedValueOnce(undefined);
    fakeCollection([]);

    await expect(
      resolveIconEntry("local", "not-real"),
    ).resolves.toBeUndefined();
  });

  it("swallows a getEntry rejection as a miss", async () => {
    getEntry.mockRejectedValueOnce(new Error("boom"));
    fakeCollection([]);

    await expect(resolveIconEntry("local", "deno")).resolves.toBeUndefined();
  });

  it("swallows a getCollection rejection as a miss", async () => {
    getEntry.mockResolvedValueOnce(undefined);
    getCollection.mockRejectedValueOnce(new Error("boom"));

    await expect(resolveIconEntry("local", "deno")).resolves.toBeUndefined();
  });
});
