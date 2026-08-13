import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IconSource } from "../src/content/source.js";
import type { IconEntry } from "../../typings/types";

const recordCollection = vi.fn(async () => {});
vi.mock("../src/content/typegen/index.js", () => ({ recordCollection }));

const { createIconLoader } = await import("../src/content/loader.js");

function entryFor(id: string): IconEntry {
  return { body: id, viewBox: "0 0 24 24", width: 24, height: 24 };
}

function fakeContext(overrides: Record<string, unknown> = {}) {
  const stored = new Map<string, unknown>();
  const metaStored = new Map<string, string>();
  return {
    store: {
      clear: () => stored.clear(),
      set: (entry: { id: string; data: unknown }) => stored.set(entry.id, entry.data),
      get: (id: string) => stored.get(id),
      keys: () => stored.keys(),
      has: (id: string) => stored.has(id),
    },
    meta: {
      get: (key: string) => metaStored.get(key),
      set: (key: string, value: string) => metaStored.set(key, value),
      delete: (key: string) => metaStored.delete(key),
      has: (key: string) => metaStored.has(key),
    },
    logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
    config: { root: new URL("file:///tmp/astro-icon-test-root/") },
    generateDigest: (data: unknown) => JSON.stringify(data),
    // Real Astro validates/coerces through the loader's schema; the fake
    // here just passes data through, matching what a schema-less shape
    // would do.
    parseData: vi.fn(async ({ data }: { data: unknown }) => data),
    collection: "icons",
    ...overrides,
  } as any;
}

function fakeSource(overrides: Partial<IconSource> = {}): IconSource {
  return {
    name: "test",
    getIcon: vi.fn(async (name: string) => entryFor(name)),
    listIcons: vi.fn(async () => []),
    ...overrides,
  };
}

beforeEach(() => {
  recordCollection.mockClear();
});

describe("createIconLoader", () => {
  it("loads exactly what listIcons() reports and types the same set", async () => {
    const source = fakeSource({ listIcons: async () => ["home", "menu"] });
    const loader = createIconLoader(source);
    const context = fakeContext();

    await loader.load(context);

    expect(context.store.get("home")).toEqual(entryFor("home"));
    expect(context.store.get("menu")).toEqual(entryFor("menu"));
    expect(recordCollection).toHaveBeenCalledWith(
      expect.any(URL),
      "build",
      "icons",
      ["home", "menu"],
    );
  });

  it("runs every entry through parseData() before storing it", async () => {
    const source = fakeSource({ listIcons: async () => ["home"] });
    const loader = createIconLoader(source);
    const context = fakeContext();

    await loader.load(context);

    expect(context.parseData).toHaveBeenCalledWith({ id: "home", data: entryFor("home") });
  });

  it("exposes a default schema on the loader", () => {
    const loader = createIconLoader(fakeSource());
    expect(loader.schema).toBeDefined();
  });

  it("warns and skips an icon the source fails to build, without throwing", async () => {
    const source = fakeSource({
      listIcons: async () => ["home", "missing"],
      getIcon: vi.fn(async (name: string) => {
        if (name === "missing") throw new Error("nope");
        return entryFor(name);
      }),
    });
    const loader = createIconLoader(source);
    const context = fakeContext();

    await loader.load(context);

    expect(context.store.get("home")).toEqual(entryFor("home"));
    expect(context.store.get("missing")).toBeUndefined();
    expect(context.logger.warn).toHaveBeenCalled();
    // The failed icon must not be typed as a valid IconName either - it
    // isn't in the store, so it can't be in the generated types.
    expect(recordCollection).toHaveBeenCalledWith(expect.any(URL), "build", "icons", ["home"]);
  });

  it("throws under strict instead of warning when building an icon fails", async () => {
    const source = fakeSource({
      listIcons: async () => ["missing"],
      getIcon: vi.fn(async () => {
        throw new Error("nope");
      }),
    });
    const loader = createIconLoader(source, { strict: true });

    await expect(loader.load(fakeContext())).rejects.toThrow();
  });

  it("warns and loads nothing when the source has no listIcons at all", async () => {
    const source = fakeSource({ listIcons: undefined });
    const loader = createIconLoader(source);
    const context = fakeContext();

    await loader.load(context);

    expect([...context.store.keys()]).toEqual([]);
    expect(context.logger.warn).toHaveBeenCalled();
  });

  it("throws under strict when the source can't list any icons", async () => {
    const source = fakeSource({ listIcons: undefined });
    const loader = createIconLoader(source, { strict: true });

    await expect(loader.load(fakeContext())).rejects.toThrow();
  });

  it("throws (or warns) when listIcons() itself rejects", async () => {
    const source = fakeSource({
      listIcons: async () => {
        throw new Error("can't enumerate");
      },
    });
    const loader = createIconLoader(source);
    const context = fakeContext();

    await loader.load(context);
    expect(context.logger.warn).toHaveBeenCalled();

    const strictLoader = createIconLoader(source, { strict: true });
    await expect(strictLoader.load(fakeContext())).rejects.toThrow();
  });
});

describe("createIconLoader / multiple sources", () => {
  it("combines sources into one collection, trying each in order", async () => {
    const mdi = fakeSource({
      name: "mdi",
      listIcons: async () => ["home"],
      getIcon: vi.fn(async (name: string) => {
        if (name !== "home") throw new Error(`"mdi" has no icon named "${name}"`);
        return entryFor(`mdi-${name}`);
      }),
    });
    const ic = fakeSource({
      name: "ic",
      listIcons: async () => ["star"],
      getIcon: vi.fn(async (name: string) => {
        if (name !== "star") throw new Error(`"ic" has no icon named "${name}"`);
        return entryFor(`ic-${name}`);
      }),
    });
    const loader = createIconLoader([mdi, ic]);
    const context = fakeContext();

    await loader.load(context);

    expect(context.store.get("home")).toEqual(entryFor("mdi-home"));
    expect(context.store.get("star")).toEqual(entryFor("ic-star"));
    expect(recordCollection).toHaveBeenCalledWith(
      expect.any(URL),
      "build",
      "icons",
      ["home", "star"],
    );
  });

  it("uses a fixed loader identity regardless of the source(s) it wraps", () => {
    const single = createIconLoader(fakeSource({ name: "mdi" }));
    const multi = createIconLoader([fakeSource({ name: "mdi" }), fakeSource({ name: "ic" })]);
    expect(single.name).toBe("astro-icon/loaders");
    expect(multi.name).toBe("astro-icon/loaders");
  });
});

describe("createIconLoader / version-based skip", () => {
  it("skips resolving anything when the source's version is unchanged", async () => {
    const getIcon = vi.fn(async (name: string) => entryFor(name));
    const source = fakeSource({
      listIcons: async () => ["home", "menu"],
      getIcon,
      getVersion: async () => "1.0.0",
    });
    const loader = createIconLoader(source);
    const context = fakeContext();

    await loader.load(context);
    expect(getIcon).toHaveBeenCalledTimes(2);

    await loader.load(context);
    expect(getIcon).toHaveBeenCalledTimes(2);
    expect(context.store.get("home")).toEqual(entryFor("home"));
    expect(context.store.get("menu")).toEqual(entryFor("menu"));
  });

  it("re-resolves everything once the source's version changes", async () => {
    const getIcon = vi.fn(async (name: string) => entryFor(name));
    let version = "1.0.0";
    const source = fakeSource({
      listIcons: async () => ["home"],
      getIcon,
      getVersion: async () => version,
    });
    const loader = createIconLoader(source);
    const context = fakeContext();

    await loader.load(context);
    expect(getIcon).toHaveBeenCalledTimes(1);

    version = "2.0.0";
    await loader.load(context);
    expect(getIcon).toHaveBeenCalledTimes(2);
  });

  it("re-resolves everything when the requested icon set changes, even with the same version", async () => {
    const getIcon = vi.fn(async (name: string) => entryFor(name));
    let names = ["home"];
    const source = fakeSource({
      listIcons: async () => names,
      getIcon,
      getVersion: async () => "1.0.0",
    });
    const loader = createIconLoader(source);
    const context = fakeContext();

    await loader.load(context);
    expect(getIcon).toHaveBeenCalledTimes(1);

    names = ["home", "menu"];
    await loader.load(context);
    expect(getIcon).toHaveBeenCalledTimes(3);
  });

  it("never skips when the source doesn't report a version", async () => {
    const getIcon = vi.fn(async (name: string) => entryFor(name));
    const source = fakeSource({ listIcons: async () => ["home"], getIcon });
    const loader = createIconLoader(source);
    const context = fakeContext();

    await loader.load(context);
    await loader.load(context);
    expect(getIcon).toHaveBeenCalledTimes(2);
  });

  it("never skips a multi-source loader unless every source reports a version", async () => {
    // mergeSources tries each source in order for every requested name, so
    // a fake that resolves anything (like this one) "wins" for every name
    // regardless of which source actually listed it - the point here is
    // just that a per-load call count that *doesn't* double on the second
    // load would mean a skip happened, which shouldn't be possible since
    // "b" reports no version at all.
    const getIconA = vi.fn(async (name: string) => entryFor(name));
    const sourceA = fakeSource({
      name: "a",
      listIcons: async () => ["home"],
      getIcon: getIconA,
      getVersion: async () => "1.0.0",
    });
    const sourceB = fakeSource({ name: "b", listIcons: async () => ["menu"] });
    const loader = createIconLoader([sourceA, sourceB]);
    const context = fakeContext();

    await loader.load(context);
    const afterFirstLoad = getIconA.mock.calls.length;
    expect(afterFirstLoad).toBeGreaterThan(0);

    await loader.load(context);
    expect(getIconA).toHaveBeenCalledTimes(afterFirstLoad * 2);
  });
});

describe("createIconLoader / timing logs", () => {
  it("logs a duration + count summary at info level after a real sync", async () => {
    const source = fakeSource({ name: "mdi", listIcons: async () => ["home", "menu"] });
    const loader = createIconLoader(source);
    const context = fakeContext();

    await loader.load(context);

    expect(context.logger.info).toHaveBeenCalledOnce();
    const [message] = context.logger.info.mock.calls[0];
    expect(message).toMatch(/^Loaded 2 icon\(s\) for the "icons" collection in /);
    expect(message).toMatch(/\d+(ms|\.\d\ds)\.$/);
  });

  it("logs the list/build breakdown separately, at debug level", async () => {
    const source = fakeSource({ name: "mdi", listIcons: async () => ["home", "menu"] });
    const loader = createIconLoader(source);
    const context = fakeContext();

    await loader.load(context);

    const [message] = context.logger.debug.mock.calls.at(-1)!;
    expect(message).toMatch(/^"icons" breakdown: list \d+(ms|\.\d\ds), build \d+(ms|\.\d\ds)\.$/);
  });

  it("does not log the info summary when a sync is skipped as up to date", async () => {
    const source = fakeSource({
      listIcons: async () => ["home"],
      getVersion: async () => "1.0.0",
    });
    const loader = createIconLoader(source);
    const context = fakeContext();

    await loader.load(context);
    context.logger.info.mockClear();
    context.logger.debug.mockClear();

    await loader.load(context);

    expect(context.logger.info).not.toHaveBeenCalled();
    expect(context.logger.debug).toHaveBeenCalledOnce();
    expect(context.logger.debug.mock.calls[0][0]).toMatch(/already up to date/);
  });
});
