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

// Typegen registration is fire-and-forget at construction time (see
// createLiveIconLoader.ts) - flush microtasks before asserting on it.
async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("createLiveIconLoader / loadEntry", () => {
  it("resolves an entry via the source's getIcon and returns it", async () => {
    const getIcon = vi.fn(async () => entry);
    const loader = createLiveIconLoader(
      { name: "test", getIcon },
      { collection: "icons" },
    );

    const result = await loader.loadEntry({
      filter: { id: "search" },
      collection: "icons",
    });

    expect(result).toEqual({ id: "search", data: entry });
    expect(getIcon).toHaveBeenCalledWith("search");
  });

  it("caches resolved entries and doesn't call getIcon again", async () => {
    const getIcon = vi.fn(async () => entry);
    const loader = createLiveIconLoader(
      { name: "test", getIcon },
      { collection: "icons" },
    );

    await loader.loadEntry({ filter: { id: "search" }, collection: "icons" });
    await loader.loadEntry({ filter: { id: "search" }, collection: "icons" });

    expect(getIcon).toHaveBeenCalledOnce();
  });

  it("wraps a thrown error as { error } instead of throwing", async () => {
    const getIcon = vi.fn(async () => {
      throw new Error("nope");
    });
    const loader = createLiveIconLoader(
      { name: "test", getIcon },
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

  it("namespaces the loader name with the source name", () => {
    const loader = createLiveIconLoader(
      {
        name: "iconify:mdi",
        getIcon: vi.fn(async () => entry),
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
        getIcon: vi.fn(async () => ({
          body: '<path d="M0 0" onload="alert(1)"/><script>alert(1)</script>',
          viewBox: "0 0 24 24",
          width: 24,
          height: 24,
        })),
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

describe("createLiveIconLoader / loadCollection", () => {
  it("errors when the source doesn't implement listIcons", async () => {
    const loader = createLiveIconLoader(
      {
        name: "test",
        getIcon: vi.fn(async () => entry),
      },
      { collection: "icons" },
    );

    const result = await loader.loadCollection({ collection: "icons" });

    expect(result).toEqual({ error: expect.any(Error) });
  });

  it("lists + resolves every icon when the source implements listIcons", async () => {
    const getIcon = vi.fn(async (name: string) => ({ ...entry, body: name }));
    const loader = createLiveIconLoader(
      {
        name: "test",
        getIcon,
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
  });

  it("skips icons that fail to resolve instead of failing the whole collection", async () => {
    const getIcon = vi.fn(async (name: string) => {
      if (name === "bad") throw new Error("nope");
      return entry;
    });
    const loader = createLiveIconLoader(
      {
        name: "test",
        getIcon,
        listIcons: async () => ["good", "bad"],
      },
      { collection: "icons" },
    );

    const result = await loader.loadCollection({ collection: "icons" });

    expect(result).toEqual({ entries: [{ id: "good", data: entry }] });
  });

  it("respects the source's concurrency cap when listing a collection", async () => {
    // Guards against buildIcons being handed an ad-hoc shape that drops `concurrency`,
    // fanning every request out at once against a rate-limited backend.
    let concurrent = 0;
    let peak = 0;
    const loader = createLiveIconLoader(
      {
        name: "api",
        concurrency: 2,
        getIcon: async () => {
          concurrent++;
          peak = Math.max(peak, concurrent);
          await new Promise((resolve) => setTimeout(resolve, 0));
          concurrent--;
          return entry;
        },
        listIcons: async () => ["a", "b", "c", "d", "e", "f"],
      },
      { collection: "icons" },
    );

    const result = await loader.loadCollection({ collection: "icons" });

    expect(peak).toBe(2);
    expect(result).toHaveProperty("entries");
  });

  it("sanitizes each icon exactly once when listing a collection", async () => {
    mockedSanitize.mockClear();
    const loader = createLiveIconLoader(
      {
        name: "test",
        getIcon: vi.fn(async () => entry),
        listIcons: async () => ["a", "b"],
      },
      { collection: "icons" },
    );

    await loader.loadCollection({ collection: "icons" });

    expect(mockedSanitize).toHaveBeenCalledTimes(2);
  });

  it("reuses the loadEntry cache when listing a collection", async () => {
    const getIcon = vi.fn(async () => entry);
    const loader = createLiveIconLoader(
      {
        name: "test",
        getIcon,
        listIcons: async () => ["search"],
      },
      { collection: "icons" },
    );

    await loader.loadEntry({ filter: { id: "search" }, collection: "icons" });
    await loader.loadCollection({ collection: "icons" });

    expect(getIcon).toHaveBeenCalledOnce();
  });
});

describe("createLiveIconLoader / resolveRoot + checkPreconditions", () => {
  it("calls resolveRoot at construction with a process.cwd()-based root", () => {
    const resolveRoot = vi.fn();
    createLiveIconLoader(
      {
        name: "test",
        getIcon: vi.fn(async () => entry),
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
          getIcon: vi.fn(async () => entry),
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
          getIcon: vi.fn(async () => entry),
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
        getIcon: vi.fn(async () => entry),
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
        getIcon: vi.fn(async () => entry),
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
        getIcon: vi.fn(async () => entry),
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
        { name: "test", getIcon: vi.fn(async () => entry) },
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
        { name: "test", getIcon: vi.fn(async () => entry) },
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
          getIcon: vi.fn(async () => entry),
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
