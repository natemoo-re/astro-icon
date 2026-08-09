import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IconSource } from "../src/core/iconSource.js";
import type { IconEntry } from "../../typings/types";

const recordCollection = vi.fn(async () => {});
vi.mock("../src/typegen.js", () => ({ recordCollection }));

const { createIconLoader } = await import("../src/loaders/createIconLoader.js");

function entryFor(id: string): IconEntry {
  return { body: id, viewBox: "0 0 24 24", width: 24, height: 24 };
}

function fakeContext(overrides: Record<string, unknown> = {}) {
  const stored = new Map<string, unknown>();
  return {
    store: {
      clear: () => stored.clear(),
      set: (entry: { id: string; data: unknown }) => stored.set(entry.id, entry.data),
      get: (id: string) => stored.get(id),
      keys: () => stored.keys(),
    },
    logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
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

  it("doesn't wrap a single source, keeping its name as the loader's own", () => {
    const source = fakeSource({ name: "mdi" });
    const loader = createIconLoader(source);
    expect(loader.name).toBe("astro-icon/loaders/icon/mdi");
  });

  it("joins names for a loader built from multiple sources", () => {
    const loader = createIconLoader([fakeSource({ name: "mdi" }), fakeSource({ name: "ic" })]);
    expect(loader.name).toBe("astro-icon/loaders/icon/mdi+ic");
  });
});
