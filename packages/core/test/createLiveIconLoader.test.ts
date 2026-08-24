import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLiveIconLoader } from "../src/content/liveLoader.js";
import { sanitizeSVGBody } from "../src/content/sanitizeSVG.js";
import { recordCollection } from "../src/content/typegen/index.js";
import type { IconEntry } from "../../typings/types";

vi.mock("../src/content/typegen/index.js", () => ({
  recordCollection: vi.fn(async () => {}),
  recordCatalog: vi.fn(async () => {}),
}));

// Pass-through spy, only for counting calls - real sanitization still runs.
vi.mock("../src/content/sanitizeSVG.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/content/sanitizeSVG.js")>();
  return { sanitizeSVGBody: vi.fn(actual.sanitizeSVGBody) };
});

const mockedRecordCollection = vi.mocked(recordCollection);
const mockedSanitize = vi.mocked(sanitizeSVGBody);

const entry: IconEntry = {
  body: "<path/>",
  viewBox: "0 0 24 24",
  width: 24,
  height: 24,
};

/** A `getIcons` that resolves every requested name to the same fixed `entry`. */
function fixedGetIcons() {
  return vi.fn(async (names: string[]) => {
    return new Map<string, IconEntry>(names.map((name) => [name, entry]));
  });
}

// Typegen registration is fire-and-forget at construction time (see
// createLiveIconLoader.ts) - flush microtasks before asserting on it.
async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("createLiveIconLoader / loadEntry", () => {
  it("resolves an entry via the source's getIcons and returns it", async () => {
    const getIcons = fixedGetIcons();
    const loader = createLiveIconLoader(
      { name: "test", getIcons },
      { collection: "icons" },
    );

    const result = await loader.loadEntry({
      filter: { id: "search" },
      collection: "icons",
    });

    expect(result).toEqual({ id: "search", data: entry });
    expect(getIcons).toHaveBeenCalledWith(["search"]);
  });

  it("caches resolved entries and doesn't call getIcons again", async () => {
    const getIcons = fixedGetIcons();
    const loader = createLiveIconLoader(
      { name: "test", getIcons },
      { collection: "icons" },
    );

    await loader.loadEntry({ filter: { id: "search" }, collection: "icons" });
    await loader.loadEntry({ filter: { id: "search" }, collection: "icons" });

    expect(getIcons).toHaveBeenCalledOnce();
  });

  it("wraps a thrown error as { error } instead of throwing", async () => {
    const getIcons = vi.fn(async (): Promise<never> => {
      throw new Error("nope");
    });
    const loader = createLiveIconLoader(
      { name: "test", getIcons },
      { collection: "icons" },
    );

    const result = await loader.loadEntry({
      filter: { id: "missing" },
      collection: "icons",
    });

    expect(result).toEqual({
      error: expect.objectContaining({ message: "nope" }),
    });
  });

  it("wraps a per-name Error in the map as { error } too", async () => {
    const cause = new Error("nope");
    const loader = createLiveIconLoader(
      {
        name: "test",
        getIcons: vi.fn(async () => new Map([["missing", cause]])),
      },
      { collection: "icons" },
    );

    const result = await loader.loadEntry({
      filter: { id: "missing" },
      collection: "icons",
    });

    expect(result).toEqual({ error: cause });
  });

  it("namespaces the loader name with the source name", () => {
    const loader = createLiveIconLoader(
      {
        name: "iconify:mdi",
        getIcons: fixedGetIcons(),
      },
      { collection: "icons" },
    );

    expect(loader.name).toBe("astro-icon/loaders/live/iconify:mdi");
  });

  it("sanitizes a custom source's entry even though it never calls parseIconSVG", async () => {
    // A custom IconSource builds its IconEntry directly (see the IconSource contract) - it
    // never has to go through parseIconSVG, so sanitization can't be allowed to live there.
    const loader = createLiveIconLoader(
      {
        name: "untrusted",
        getIcons: vi.fn(
          async () =>
            new Map([
              [
                "evil",
                {
                  body: '<path d="M0 0" onload="alert(1)"/><script>alert(1)</script>',
                  viewBox: "0 0 24 24",
                  width: 24,
                  height: 24,
                },
              ],
            ]),
        ),
      },
      { collection: "icons" },
    );

    const result = await loader.loadEntry({
      filter: { id: "evil" },
      collection: "icons",
    });

    expect(result).toEqual({
      id: "evil",
      data: expect.objectContaining({ body: '<path d="M0 0" />' }),
    });
  });
});

describe("createLiveIconLoader / loadCollection (whole collection, via listIcons)", () => {
  it("errors when the source implements neither listIcons nor gets a filter", async () => {
    const loader = createLiveIconLoader(
      {
        name: "test",
        getIcons: fixedGetIcons(),
      },
      { collection: "icons" },
    );

    const result = await loader.loadCollection({ collection: "icons" });

    expect(result).toEqual({ error: expect.any(Error) });
  });

  it("lists + resolves every icon when the source implements listIcons", async () => {
    const getIcons = vi.fn(async (names: string[]) => {
      return new Map<string, IconEntry>(
        names.map((name) => [name, { ...entry, body: name }]),
      );
    });
    const loader = createLiveIconLoader(
      {
        name: "test",
        getIcons,
        listIcons: async () => ["a", "b"],
      },
      { collection: "icons" },
    );

    const result = await loader.loadCollection({ collection: "icons" });

    expect(result).toEqual({
      entries: [
        { id: "a", data: { ...entry, body: "a" } },
        { id: "b", data: { ...entry, body: "b" } },
      ],
    });
    // One batched call for the whole listed set, not one per name.
    expect(getIcons).toHaveBeenCalledOnce();
    expect(getIcons).toHaveBeenCalledWith(["a", "b"]);
  });

  it("skips icons that fail to resolve instead of failing the whole collection", async () => {
    const loader = createLiveIconLoader(
      {
        name: "test",
        getIcons: vi.fn(async (names: string[]) => {
          return new Map<string, IconEntry | Error>(
            names.map((name) => [
              name,
              name === "bad" ? new Error("nope") : entry,
            ]),
          );
        }),
        listIcons: async () => ["good", "bad"],
      },
      { collection: "icons" },
    );

    const result = await loader.loadCollection({ collection: "icons" });

    expect(result).toEqual({ entries: [{ id: "good", data: entry }] });
  });

  it("sanitizes each icon exactly once when listing a collection", async () => {
    mockedSanitize.mockClear();
    const loader = createLiveIconLoader(
      {
        name: "test",
        getIcons: fixedGetIcons(),
        listIcons: async () => ["a", "b"],
      },
      { collection: "icons" },
    );

    await loader.loadCollection({ collection: "icons" });

    expect(mockedSanitize).toHaveBeenCalledTimes(2);
  });

  it("reuses the loadEntry cache when listing a collection", async () => {
    const getIcons = fixedGetIcons();
    const loader = createLiveIconLoader(
      {
        name: "test",
        getIcons,
        listIcons: async () => ["search"],
      },
      { collection: "icons" },
    );

    await loader.loadEntry({ filter: { id: "search" }, collection: "icons" });
    await loader.loadCollection({ collection: "icons" });

    expect(getIcons).toHaveBeenCalledOnce();
  });
});

describe("createLiveIconLoader / loadCollection (specific subset, via filter.ids)", () => {
  it("resolves exactly the given ids in one batched call, without calling listIcons again", async () => {
    const getIcons = vi.fn(async (names: string[]) => {
      return new Map<string, IconEntry>(
        names.map((name) => [name, { ...entry, body: name }]),
      );
    });
    const listIcons = vi.fn(async () => ["should", "not", "be", "used"]);
    const loader = createLiveIconLoader(
      { name: "test", getIcons, listIcons },
      { collection: "icons" },
    );
    // `listIcons` already ran once at construction, for typegen's own side effect (see
    // createLiveIconLoader's doc comment) - unrelated to this loadCollection call, so it's
    // cleared here rather than asserted on.
    await flush();
    listIcons.mockClear();

    const result = await loader.loadCollection({
      collection: "icons",
      filter: { ids: ["a", "b"] },
    });

    expect(result).toEqual({
      entries: [
        { id: "a", data: { ...entry, body: "a" } },
        { id: "b", data: { ...entry, body: "b" } },
      ],
    });
    expect(getIcons).toHaveBeenCalledOnce();
    expect(getIcons).toHaveBeenCalledWith(["a", "b"]);
    expect(listIcons).not.toHaveBeenCalled();
  });

  it("works even when the source has no listIcons at all - unlike the whole-collection path", async () => {
    const loader = createLiveIconLoader(
      { name: "test", getIcons: fixedGetIcons() },
      { collection: "icons" },
    );

    const result = await loader.loadCollection({
      collection: "icons",
      filter: { ids: ["a"] },
    });

    expect(result).toEqual({ entries: [{ id: "a", data: entry }] });
  });

  it("skips ids that fail to resolve instead of failing the whole batch", async () => {
    const loader = createLiveIconLoader(
      {
        name: "test",
        getIcons: vi.fn(async (names: string[]) => {
          return new Map<string, IconEntry | Error>(
            names.map((name) => [
              name,
              name === "bad" ? new Error("nope") : entry,
            ]),
          );
        }),
      },
      { collection: "icons" },
    );

    const result = await loader.loadCollection({
      collection: "icons",
      filter: { ids: ["good", "bad"] },
    });

    expect(result).toEqual({ entries: [{ id: "good", data: entry }] });
  });

  it("warms the loadEntry cache, so a later getLiveEntry for the same id is a cache hit", async () => {
    const getIcons = vi.fn(async (names: string[]) => {
      return new Map<string, IconEntry>(names.map((name) => [name, entry]));
    });
    const loader = createLiveIconLoader(
      { name: "test", getIcons },
      { collection: "icons" },
    );

    await loader.loadCollection({
      collection: "icons",
      filter: { ids: ["a", "b"] },
    });
    getIcons.mockClear();

    await loader.loadEntry({ filter: { id: "a" }, collection: "icons" });

    expect(getIcons).not.toHaveBeenCalled();
  });
});

describe("createLiveIconLoader / resolveRoot + checkPreconditions", () => {
  it("calls resolveRoot at construction with a process.cwd()-based root", () => {
    const resolveRoot = vi.fn();
    createLiveIconLoader(
      {
        name: "test",
        getIcons: fixedGetIcons(),
        resolveRoot,
      },
      { collection: "icons" },
    );

    expect(resolveRoot).toHaveBeenCalledWith(expect.any(URL));
  });

  it("warns via the console when checkPreconditions() rejects, without throwing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      createLiveIconLoader(
        {
          name: "broken",
          getIcons: fixedGetIcons(),
          checkPreconditions: async () => {
            throw new Error("not installed");
          },
        },
        { collection: "icons" },
      );

      await flush();

      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('"broken" isn\'t usable: not installed'),
      );
    } finally {
      warn.mockRestore();
    }
  });
});

describe("createLiveIconLoader / loadCollection duration logging", () => {
  it("debug-logs loadCollection's duration on success", async () => {
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    try {
      const loader = createLiveIconLoader(
        {
          name: "test",
          getIcons: fixedGetIcons(),
          listIcons: async () => ["a"],
        },
        { collection: "icons" },
      );

      await loader.loadCollection({ collection: "icons" });

      expect(debug).toHaveBeenCalledWith(
        expect.stringMatching(
          /Loaded 1 icon\(s\) for "test"'s live collection in/,
        ),
      );
    } finally {
      debug.mockRestore();
    }
  });
});

describe("createLiveIconLoader typegen", () => {
  beforeEach(() => {
    mockedRecordCollection.mockClear();
  });

  it("records an empty list keyed by the collection option, not source.name, without waiting on listIcons()", async () => {
    // `LiveCollectionName` only needs the collection key to exist - a live icon's specific name is never
    // validated against a catalog (see names.d.ts), so this per-collection list stays empty.
    const listIcons = vi.fn(async () => ["home", "search"]);
    createLiveIconLoader(
      {
        name: "iconify-local:mdi",
        getIcons: fixedGetIcons(),
        listIcons,
      },
      { collection: "mdi" },
    );

    await flush();

    expect(mockedRecordCollection).toHaveBeenCalledWith(
      expect.any(URL),
      "live",
      "mdi",
      [],
    );
    // Still called for its side effect: sources like `iconifyLocalSource` use listIcons() to record their own pack catalog.
    expect(listIcons).toHaveBeenCalledOnce();
  });

  it("records an empty list when the source has no listIcons", async () => {
    createLiveIconLoader(
      {
        name: "no-listing",
        getIcons: fixedGetIcons(),
      },
      { collection: "custom" },
    );

    await flush();

    expect(mockedRecordCollection).toHaveBeenCalledWith(
      expect.any(URL),
      "live",
      "custom",
      [],
    );
  });

  it("falls back to an empty list when listIcons rejects", async () => {
    createLiveIconLoader(
      {
        name: "api-only",
        getIcons: fixedGetIcons(),
        listIcons: async () => {
          throw new Error("not installed locally");
        },
      },
      { collection: "remote" },
    );

    await flush();

    expect(mockedRecordCollection).toHaveBeenCalledWith(
      expect.any(URL),
      "live",
      "remote",
      [],
    );
  });
});

describe("createLiveIconLoader / collection key verification", () => {
  beforeEach(() => {
    mockedRecordCollection.mockClear();
  });

  it("stays quiet when the declared collection matches the key Astro reports", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const loader = createLiveIconLoader(
        { name: "test", getIcons: fixedGetIcons() },
        { collection: "icons" },
      );

      await loader.loadEntry({ filter: { id: "a" }, collection: "icons" });

      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it("warns once and re-records typegen under the real key on a mismatch", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const loader = createLiveIconLoader(
        { name: "test", getIcons: fixedGetIcons() },
        { collection: "typo" },
      );
      await flush();
      mockedRecordCollection.mockClear();

      await loader.loadEntry({ filter: { id: "a" }, collection: "icons" });
      await loader.loadEntry({ filter: { id: "b" }, collection: "icons" });
      await flush();

      expect(warn).toHaveBeenCalledOnce();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('"icons"'));
      expect(mockedRecordCollection).toHaveBeenCalledWith(
        expect.any(URL),
        "live",
        "icons",
        [],
      );
    } finally {
      warn.mockRestore();
    }
  });

  it("verifies via loadCollection too", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const loader = createLiveIconLoader(
        {
          name: "test",
          getIcons: fixedGetIcons(),
          listIcons: async () => ["a"],
        },
        { collection: "typo" },
      );

      await loader.loadCollection({ collection: "icons" });

      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('created with `collection: "typo"`'),
      );
    } finally {
      warn.mockRestore();
    }
  });
});
