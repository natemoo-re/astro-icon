import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IconEntry } from "../../typings/types";

const recordCollection = vi.fn(async () => {});
vi.mock("../src/content/typegen/index.js", () => ({ recordCollection }));

const { createLiveIconLoader } = await import(
  "../src/content/liveLoader.js"
);

const entry: IconEntry = {
  body: "<path/>",
  viewBox: "0 0 24 24",
  width: 24,
  height: 24,
};

// Typegen registration is fire-and-forget at construction time (see
// createLiveIconLoader.ts) - flush microtasks before asserting on it.
async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("createLiveIconLoader / loadEntry", () => {
  it("resolves an entry via the source's getIcon and returns it", async () => {
    const getIcon = vi.fn(async () => entry);
    const loader = createLiveIconLoader({ name: "test", getIcon });

    const result = await loader.loadEntry({
      filter: { id: "search" },
      collection: "icons",
    });

    expect(result).toEqual({ id: "search", data: entry });
    expect(getIcon).toHaveBeenCalledWith("search");
  });

  it("caches resolved entries and doesn't call getIcon again", async () => {
    const getIcon = vi.fn(async () => entry);
    const loader = createLiveIconLoader({ name: "test", getIcon });

    await loader.loadEntry({ filter: { id: "search" }, collection: "icons" });
    await loader.loadEntry({ filter: { id: "search" }, collection: "icons" });

    expect(getIcon).toHaveBeenCalledOnce();
  });

  it("wraps a thrown error as { error } instead of throwing", async () => {
    const getIcon = vi.fn(async () => {
      throw new Error("nope");
    });
    const loader = createLiveIconLoader({ name: "test", getIcon });

    const result = await loader.loadEntry({
      filter: { id: "missing" },
      collection: "icons",
    });

    expect(result).toEqual({ error: expect.objectContaining({ message: "nope" }) });
  });

  it("namespaces the loader name with the source name", () => {
    const loader = createLiveIconLoader({
      name: "iconify:mdi",
      getIcon: vi.fn(async () => entry),
    });

    expect(loader.name).toBe("astro-icon/loaders/live/iconify:mdi");
  });
});

describe("createLiveIconLoader / loadCollection", () => {
  it("errors when the source doesn't implement listIcons", async () => {
    const loader = createLiveIconLoader({
      name: "test",
      getIcon: vi.fn(async () => entry),
    });

    const result = await loader.loadCollection({ collection: "icons" });

    expect(result).toEqual({ error: expect.any(Error) });
  });

  it("lists + resolves every icon when the source implements listIcons", async () => {
    const getIcon = vi.fn(async (name: string) => ({ ...entry, body: name }));
    const loader = createLiveIconLoader({
      name: "test",
      getIcon,
      listIcons: async () => ["a", "b"],
    });

    const result = await loader.loadCollection({ collection: "icons" });

    expect(result).toEqual({
      entries: [
        { id: "a", data: { ...entry, body: "a" } },
        { id: "b", data: { ...entry, body: "b" } },
      ],
    });
  });

  it("skips icons that fail to resolve instead of failing the whole collection", async () => {
    const getIcon = vi.fn(async (name: string) => {
      if (name === "bad") throw new Error("nope");
      return entry;
    });
    const loader = createLiveIconLoader({
      name: "test",
      getIcon,
      listIcons: async () => ["good", "bad"],
    });

    const result = await loader.loadCollection({ collection: "icons" });

    expect(result).toEqual({ entries: [{ id: "good", data: entry }] });
  });

  it("reuses the loadEntry cache when listing a collection", async () => {
    const getIcon = vi.fn(async () => entry);
    const loader = createLiveIconLoader({
      name: "test",
      getIcon,
      listIcons: async () => ["search"],
    });

    await loader.loadEntry({ filter: { id: "search" }, collection: "icons" });
    await loader.loadCollection({ collection: "icons" });

    expect(getIcon).toHaveBeenCalledOnce();
  });
});

describe("createLiveIconLoader typegen", () => {
  beforeEach(() => {
    recordCollection.mockClear();
  });

  it("records an empty list keyed by source.name, without waiting on listIcons()", async () => {
    // `LiveCollectionName` only needs the collection key to exist - a live icon's specific name is never
    // validated against a catalog (see names.d.ts), so this per-collection list stays empty.
    const listIcons = vi.fn(async () => ["home", "search"]);
    createLiveIconLoader({ name: "mdi", getIcon: vi.fn(async () => entry), listIcons });

    await flush();

    expect(recordCollection).toHaveBeenCalledWith(expect.any(URL), "live", "mdi", []);
    // Still called for its side effect: sources like `iconifySource` use listIcons() to record their own pack catalog.
    expect(listIcons).toHaveBeenCalledOnce();
  });

  it("records an empty list when the source has no listIcons", async () => {
    createLiveIconLoader({ name: "no-listing", getIcon: vi.fn(async () => entry) });

    await flush();

    expect(recordCollection).toHaveBeenCalledWith(
      expect.any(URL),
      "live",
      "no-listing",
      [],
    );
  });

  it("falls back to an empty list when listIcons rejects", async () => {
    createLiveIconLoader({
      name: "api-only",
      getIcon: vi.fn(async () => entry),
      listIcons: async () => {
        throw new Error("not installed locally");
      },
    });

    await flush();

    expect(recordCollection).toHaveBeenCalledWith(
      expect.any(URL),
      "live",
      "api-only",
      [],
    );
  });
});
