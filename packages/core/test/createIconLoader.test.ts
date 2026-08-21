import { EventEmitter } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createIconLoader } from "../src/content/loader.js";
import { mergeSources } from "../src/content/compositeSource.js";
import { localSource } from "../src/content/local/source.js";
import { recordCollection } from "../src/content/typegen/index.js";
import { recordSprite } from "../src/content/sprite/manifest.js";
import type { IconSource } from "../src/content/source.js";
import type { IconEntry } from "../../typings/types";

vi.mock("../src/content/typegen/index.js", () => ({
  recordCollection: vi.fn(async () => {}),
  recordCatalog: vi.fn(async () => {}),
}));

// Otherwise the loader writes real sprite state + asset files to the fake
// `config.root` below on every test run - this keeps the test hermetic and
// lets tests assert exactly what the loader passed, the same reason
// recordCollection is mocked above.
vi.mock("../src/content/sprite/manifest.js", () => ({
  recordSprite: vi.fn(async () => {}),
}));

const mockedRecordCollection = vi.mocked(recordCollection);
const mockedRecordSprite = vi.mocked(recordSprite);

/** Exercises the loader's own `.load()`, the same entry point Astro calls - just via the public `createIconLoader()` rather than Astro's full `LoaderContext`. */
function sync(source: IconSource | IconSource[], strict: boolean) {
  return createIconLoader(source, { strict }).load;
}

function entryFor(id: string): IconEntry {
  return { body: id, viewBox: "0 0 24 24", width: 24, height: 24 };
}

const SQUARE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24"/></svg>`;

function fakeWatcher() {
  const emitter = new EventEmitter();
  return Object.assign(emitter, { add: vi.fn() });
}

function fakeContext(watcher?: ReturnType<typeof fakeWatcher>) {
  const stored = new Map<string, IconEntry>();
  const metaStored = new Map<string, string>();
  return {
    store: {
      clear: () => stored.clear(),
      set: (entry: { id: string; data: IconEntry }) => {
        stored.set(entry.id, entry.data);
        return true;
      },
      get: (id: string) => stored.get(id),
      keys: () => [...stored.keys()],
      has: (id: string) => stored.has(id),
      delete: (id: string) => stored.delete(id),
      // Matches real Astro's DataStore shape ([id, { data, ... }]), unlike get()
      // above (kept simplified since many existing tests depend on it as-is).
      entries: () =>
        [...stored.entries()].map(([id, data]) => [id, { data }] as const),
    },
    meta: {
      get: (key: string) => metaStored.get(key),
      set: (key: string, value: string) => metaStored.set(key, value),
      delete: (key: string) => metaStored.delete(key),
      has: (key: string) => metaStored.has(key),
    },
    logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
    config: { root: new URL("file:///tmp/astro-icon-test-root/") },
    generateDigest: (data: IconEntry) => JSON.stringify(data),
    // Real Astro validates/coerces through the loader's schema; the fake
    // here just passes data through, matching what a schema-less shape
    // would do.
    parseData: vi.fn(async ({ data }: { data: IconEntry }) => data),
    collection: "icons",
    watcher,
  };
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
  mockedRecordCollection.mockClear();
  mockedRecordSprite.mockClear();
});

describe("createIconLoader", () => {
  it("records sprite: true (the default) with a content hash and rendered asset once icons are built", async () => {
    const source = fakeSource({ listIcons: async () => ["home"] });
    const loader = createIconLoader(source);
    await loader.load(fakeContext());

    expect(mockedRecordSprite).toHaveBeenCalledWith(
      expect.any(URL),
      "icons",
      expect.objectContaining({
        sprite: true,
        hash: expect.any(String),
        assetContent: expect.stringContaining("<symbol"),
      }),
    );
  });

  it("records sprite: false immediately, without waiting for icons to build", async () => {
    const source = fakeSource({ listIcons: async () => ["home"] });
    const loader = createIconLoader(source, { sprite: false });
    await loader.load(fakeContext());

    expect(mockedRecordSprite).toHaveBeenCalledWith(expect.any(URL), "icons", {
      sprite: false,
    });
  });

  it("loads exactly what listIcons() reports and types the same set", async () => {
    const source = fakeSource({ listIcons: async () => ["home", "menu"] });
    const context = fakeContext();

    await sync(source, false)(context);

    expect(context.store.get("home")).toEqual(entryFor("home"));
    expect(context.store.get("menu")).toEqual(entryFor("menu"));
    expect(mockedRecordCollection).toHaveBeenCalledWith(
      expect.any(URL),
      "build",
      "icons",
      ["home", "menu"],
    );
  });

  it("runs every entry through parseData() before storing it", async () => {
    const source = fakeSource({ listIcons: async () => ["home"] });
    const context = fakeContext();

    await sync(source, false)(context);

    expect(context.parseData).toHaveBeenCalledWith({
      id: "home",
      data: entryFor("home"),
    });
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
    const context = fakeContext();

    await sync(source, false)(context);

    expect(context.store.get("home")).toEqual(entryFor("home"));
    expect(context.store.get("missing")).toBeUndefined();
    expect(context.logger.warn).toHaveBeenCalled();
    // The failed icon must not be typed as a valid IconName either - it
    // isn't in the store, so it can't be in the generated types.
    expect(mockedRecordCollection).toHaveBeenCalledWith(
      expect.any(URL),
      "build",
      "icons",
      ["home"],
    );
  });

  it("throws under strict instead of warning when building an icon fails", async () => {
    const source = fakeSource({
      listIcons: async () => ["missing"],
      getIcon: vi.fn(async () => {
        throw new Error("nope");
      }),
    });

    await expect(sync(source, true)(fakeContext())).rejects.toThrow();
  });

  it("warns and loads nothing when the source has no listIcons at all", async () => {
    const source = fakeSource({ listIcons: undefined });
    const context = fakeContext();

    await sync(source, false)(context);

    expect([...context.store.keys()]).toEqual([]);
    expect(context.logger.warn).toHaveBeenCalled();
  });

  it("throws under strict when the source can't list any icons", async () => {
    const source = fakeSource({ listIcons: undefined });

    await expect(sync(source, true)(fakeContext())).rejects.toThrow();
  });

  it("throws (or warns) when listIcons() itself rejects", async () => {
    const source = fakeSource({
      listIcons: async () => {
        throw new Error("can't enumerate");
      },
    });
    const context = fakeContext();

    await sync(source, false)(context);
    expect(context.logger.warn).toHaveBeenCalled();

    await expect(sync(source, true)(fakeContext())).rejects.toThrow();
  });
});

describe("createIconLoader / multiple sources", () => {
  it("combines sources into one collection, trying each in order", async () => {
    const mdi = fakeSource({
      name: "mdi",
      listIcons: async () => ["home"],
      getIcon: vi.fn(async (name: string) => {
        if (name !== "home")
          throw new Error(`"mdi" has no icon named "${name}"`);
        return entryFor(`mdi-${name}`);
      }),
    });
    const ic = fakeSource({
      name: "ic",
      listIcons: async () => ["star"],
      getIcon: vi.fn(async (name: string) => {
        if (name !== "star")
          throw new Error(`"ic" has no icon named "${name}"`);
        return entryFor(`ic-${name}`);
      }),
    });
    const context = fakeContext();

    await sync(mergeSources([mdi, ic]), false)(context);

    expect(context.store.get("home")).toEqual(entryFor("mdi-home"));
    expect(context.store.get("star")).toEqual(entryFor("ic-star"));
    expect(mockedRecordCollection).toHaveBeenCalledWith(
      expect.any(URL),
      "build",
      "icons",
      ["home", "star"],
    );
  });

  it("uses a fixed loader identity regardless of the source(s) it wraps", () => {
    const single = createIconLoader(fakeSource({ name: "mdi" }));
    const multi = createIconLoader([
      fakeSource({ name: "mdi" }),
      fakeSource({ name: "ic" }),
    ]);
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
    const load = sync(source, false);
    const context = fakeContext();

    await load(context);
    expect(getIcon).toHaveBeenCalledTimes(2);

    await load(context);
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
    const load = sync(source, false);
    const context = fakeContext();

    await load(context);
    expect(getIcon).toHaveBeenCalledTimes(1);

    version = "2.0.0";
    await load(context);
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
    const load = sync(source, false);
    const context = fakeContext();

    await load(context);
    expect(getIcon).toHaveBeenCalledTimes(1);

    names = ["home", "menu"];
    await load(context);
    expect(getIcon).toHaveBeenCalledTimes(3);
  });

  it("never skips when the source doesn't report a version", async () => {
    const getIcon = vi.fn(async (name: string) => entryFor(name));
    const source = fakeSource({ listIcons: async () => ["home"], getIcon });
    const load = sync(source, false);
    const context = fakeContext();

    await load(context);
    await load(context);
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
    const load = sync(mergeSources([sourceA, sourceB]), false);
    const context = fakeContext();

    await load(context);
    const afterFirstLoad = getIconA.mock.calls.length;
    expect(afterFirstLoad).toBeGreaterThan(0);

    await load(context);
    expect(getIconA).toHaveBeenCalledTimes(afterFirstLoad * 2);
  });
});

describe("createIconLoader / timing logs", () => {
  it("logs a duration + count summary at info level after a real sync", async () => {
    const source = fakeSource({
      name: "mdi",
      listIcons: async () => ["home", "menu"],
    });
    const context = fakeContext();

    await sync(source, false)(context);

    expect(context.logger.info).toHaveBeenCalledOnce();
    const [message] = context.logger.info.mock.calls[0];
    expect(message).toMatch(
      /^Loaded 2 icon\(s\) for the "icons" collection in /,
    );
    expect(message).toMatch(/\d+(ms|\.\d\ds)\.$/);
  });

  it("logs the list/build breakdown separately, at debug level", async () => {
    const source = fakeSource({
      name: "mdi",
      listIcons: async () => ["home", "menu"],
    });
    const context = fakeContext();

    await sync(source, false)(context);

    const [message] = context.logger.debug.mock.calls.at(-1)!;
    expect(message).toMatch(
      /^"icons" breakdown: list \d+(ms|\.\d\ds), build \d+(ms|\.\d\ds)\.$/,
    );
  });

  it("does not log the info summary when a sync is skipped as up to date", async () => {
    const source = fakeSource({
      listIcons: async () => ["home"],
      getVersion: async () => "1.0.0",
    });
    const load = sync(source, false);
    const context = fakeContext();

    await load(context);
    context.logger.info.mockClear();
    context.logger.debug.mockClear();

    await load(context);

    expect(context.logger.info).not.toHaveBeenCalled();
    expect(context.logger.debug).toHaveBeenCalledOnce();
    expect(context.logger.debug.mock.calls[0][0]).toMatch(/already up to date/);
  });
});

describe("createIconLoader / watching multiple composed local sources", () => {
  let dirA: string;
  let dirB: string;

  beforeEach(async () => {
    dirA = await mkdtemp(join(tmpdir(), "astro-icon-composed-a-"));
    dirB = await mkdtemp(join(tmpdir(), "astro-icon-composed-b-"));
  });

  afterEach(async () => {
    await rm(dirA, { recursive: true, force: true });
    await rm(dirB, { recursive: true, force: true });
  });

  it("watches every composed localSource()'s own directory", async () => {
    await writeFile(join(dirA, "a-only.svg"), SQUARE_SVG);
    await writeFile(join(dirB, "b-only.svg"), SQUARE_SVG);
    const source = mergeSources([localSource(dirA), localSource(dirB)]);
    const watcher = fakeWatcher();
    const context = fakeContext(watcher);

    await sync(source, false)(context);

    expect(watcher.add).toHaveBeenCalledWith(dirA);
    expect(watcher.add).toHaveBeenCalledWith(dirB);
  });

  it("adding a file to either composed directory surfaces it in the store", async () => {
    const source = mergeSources([localSource(dirA), localSource(dirB)]);
    const watcher = fakeWatcher();
    const context = fakeContext(watcher);
    await sync(source, false)(context);

    await writeFile(join(dirA, "logo.svg"), SQUARE_SVG);
    watcher.emit("add", join(dirA, "logo.svg"));
    await vi.waitFor(() => expect(context.store.has("logo")).toBe(true));

    await mkdir(join(dirB, "nested"), { recursive: true });
    await writeFile(join(dirB, "nested", "icon.svg"), SQUARE_SVG);
    watcher.emit("add", join(dirB, "nested", "icon.svg"));
    await vi.waitFor(() => expect(context.store.has("nested/icon")).toBe(true));
  });

  // The shadowing footgun documented on `IconSource.watch`: two composed sources defining the
  // same icon name always resolve to the earlier source's file, `getIcon`'s own order. Editing
  // the shadowed (later) source's file still triggers a resync, it just re-resolves to the same
  // unchanged winner - so the edit appears to do nothing.
  it("shadows a later source's same-named icon, even after that file changes", async () => {
    await writeFile(join(dirA, "home.svg"), SQUARE_SVG);
    await writeFile(join(dirB, "home.svg"), SQUARE_SVG);
    const source = mergeSources([localSource(dirA), localSource(dirB)]);
    const watcher = fakeWatcher();
    const context = fakeContext(watcher);
    await sync(source, false)(context);

    const before = context.store.get("home");

    const updated = `<svg viewBox="0 0 32 32"><circle r="16"/></svg>`;
    await writeFile(join(dirB, "home.svg"), updated);
    watcher.emit("change", join(dirB, "home.svg"));

    // Give the (unawaited) watcher-driven resync a turn to run.
    await Promise.resolve();
    await Promise.resolve();

    expect(context.store.get("home")).toEqual(before);
    expect((context.store.get("home") as IconEntry).viewBox).not.toBe(
      "0 0 32 32",
    );
  });
});

describe("createIconLoader / localSource re-sync caching", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "astro-icon-resync-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  // `localSource()` caches per-file by content hash internally (see localSource.test.ts), and
  // that cache lives as long as the source instance does - which, for a real `createIconLoader`,
  // is the lifetime of the dev-server process, not just one `load()` call. So a full resync
  // triggered by the directory's overall version changing (one file edited) still only
  // re-optimizes the file that actually changed, as long as it's the same source instance being
  // synced again - unlike calling `localSource()` fresh each time (see the old `localIcons()`
  // wrapper this replaced), which had no cache to reuse.
  it("only re-optimizes the icon whose file actually changed, across two full resyncs of the same source instance", async () => {
    await writeFile(join(dir, "home.svg"), SQUARE_SVG);
    await writeFile(join(dir, "menu.svg"), SQUARE_SVG);
    const optimize = vi.fn((svg: string) => svg);
    const source = localSource(dir, { optimize });
    const load = sync(source, false);
    const context = fakeContext();

    await load(context);
    expect(optimize).toHaveBeenCalledTimes(2);

    await writeFile(
      join(dir, "home.svg"),
      `<svg viewBox="0 0 32 32"><circle r="16"/></svg>`,
    );

    await load(context);
    expect(optimize).toHaveBeenCalledTimes(3);
  });
});
