import { afterEach, describe, expect, it, vi } from "vitest";

const getEntry = vi.fn();
const getCollection = vi.fn();
const getLiveEntry = vi.fn();
vi.mock("astro:content", () => ({
  getEntry: (...args: unknown[]) => getEntry(...args),
  getCollection: (...args: unknown[]) => getCollection(...args),
  getLiveEntry: (...args: unknown[]) => getLiveEntry(...args),
}));

const { prepareIcon, prepareLiveIcon } = await import(
  "../src/render/prepareIcon.js"
);

afterEach(() => {
  getEntry.mockReset();
  getCollection.mockReset();
  getLiveEntry.mockReset();
});

const entryData = { body: "<path/>", viewBox: "0 0 24 24", width: 24, height: 24 };

/**
 * Fakes `getCollection`'s real filtering behavior (see `lookupEntry.test.ts`) - `resolveIconEntry`
 * calls it twice on a miss (once filtered, for the case-insensitive fallback; once unfiltered, via
 * `isCollectionEmpty`), so a mock that ignores the filter would report a false-positive fallback
 * match here.
 */
function fakeCollection(entries: { id: string }[]) {
  getCollection.mockImplementation(
    async (_collection: string, filter?: (entry: unknown) => boolean) =>
      filter ? entries.filter(filter) : entries,
  );
}

describe("prepareIcon", () => {
  it("throws for an empty name", async () => {
    await expect(prepareIcon("")).rejects.toThrow(/Invalid "name" provided/);
  });

  it("resolves a bare name against the default 'icons' collection, marker unprefixed", async () => {
    getEntry.mockResolvedValueOnce({ data: entryData });

    const { entry, marker } = await prepareIcon("search");

    expect(getEntry).toHaveBeenCalledWith("icons", "search");
    expect(entry).toBe(entryData);
    expect(marker).toBe("search");
  });

  it("resolves a 'collection:name' form against that collection, marker prefixed", async () => {
    getEntry.mockResolvedValueOnce({ data: entryData });

    const { entry, marker } = await prepareIcon("mdi:search");

    expect(getEntry).toHaveBeenCalledWith("mdi", "search");
    expect(entry).toBe(entryData);
    expect(marker).toBe("mdi:search");
  });

  it("splits only on the first colon, so the marker round-trips exactly", async () => {
    getEntry.mockResolvedValueOnce({ data: entryData });

    const { marker } = await prepareIcon("mdi:foo:bar");

    expect(getEntry).toHaveBeenCalledWith("mdi", "foo:bar");
    expect(marker).toBe("mdi:foo:bar");
  });

  /** `renderTimeError`'s hint lives on the thrown `AstroIconError`, not in `.message` - so assertions here read `.hint` directly instead of matching `.message` against the hint text. */
  async function hintFor(name: string): Promise<string | undefined> {
    try {
      await prepareIcon(name);
      throw new Error("expected prepareIcon to throw");
    } catch (ex) {
      return (ex as { hint?: string }).hint;
    }
  }

  it("hints at an empty default collection for a bare miss", async () => {
    getEntry.mockResolvedValueOnce(undefined);
    fakeCollection([]);

    expect(await hintFor("search")).toMatch(
      /The "icons" collection loaded no icons at all/,
    );
  });

  it("hints at a non-empty default collection missing this name for a bare miss", async () => {
    getEntry.mockResolvedValueOnce(undefined);
    fakeCollection([{ id: "menu" }]);

    expect(await hintFor("search")).toMatch(
      /No collection named "icons" produced an icon named "search"/,
    );
  });

  it("hints at an empty named collection for a prefixed miss", async () => {
    getEntry.mockResolvedValueOnce(undefined);
    fakeCollection([]);

    expect(await hintFor("mdi:search")).toMatch(
      /The "mdi" collection loaded no icons at all/,
    );
  });

  it("hints at a non-empty named collection missing this name for a prefixed miss", async () => {
    getEntry.mockResolvedValueOnce(undefined);
    fakeCollection([{ id: "menu" }]);

    expect(await hintFor("mdi:search")).toMatch(
      /The "mdi" collection doesn't have an icon named "search"/,
    );
  });
});

describe("prepareLiveIcon", () => {
  it("throws when collection or icon is missing", async () => {
    await expect(prepareLiveIcon("", "search")).rejects.toThrow(
      /Invalid "collection" or "icon" provided/,
    );
    await expect(prepareLiveIcon("mdi", "")).rejects.toThrow(
      /Invalid "collection" or "icon" provided/,
    );
  });

  it("resolves an entry, marker always prefixed", async () => {
    getLiveEntry.mockResolvedValueOnce({ entry: { data: entryData } });

    const result = await prepareLiveIcon("mdi", "search");

    expect(result).toEqual({ entry: entryData, marker: "mdi:search" });
  });

  it("warns and returns undefined (renders nothing) on an error result", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      getLiveEntry.mockResolvedValueOnce({ error: new Error("boom") });

      const result = await prepareLiveIcon("mdi", "search");

      expect(result).toBeUndefined();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('failed to load "mdi:search": boom'),
      );
    } finally {
      warn.mockRestore();
    }
  });

  it("warns and returns undefined when neither entry nor error came back", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      getLiveEntry.mockResolvedValueOnce({});

      const result = await prepareLiveIcon("mdi", "search");

      expect(result).toBeUndefined();
      expect(warn).toHaveBeenCalledOnce();
    } finally {
      warn.mockRestore();
    }
  });
});
