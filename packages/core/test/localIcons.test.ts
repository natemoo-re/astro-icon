import { EventEmitter } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const recordCollection = vi.fn(async () => {});
vi.mock("../src/typegen.js", () => ({ recordCollection }));

const { localIcons } = await import("../src/local/localIcons.js");

const SQUARE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24"/></svg>`;

let dir: string;
let root: URL;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "astro-icon-localicons-"));
  root = new URL(`file://${dir}/`);
  recordCollection.mockClear();
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function write(relativePath: string, content: string) {
  const full = join(dir, "icons", relativePath);
  await mkdir(join(full, ".."), { recursive: true });
  await writeFile(full, content);
}

function fakeWatcher() {
  const emitter = new EventEmitter();
  return Object.assign(emitter, { add: vi.fn() });
}

function fakeContext(overrides: Record<string, unknown> = {}) {
  // Mirrors Astro's real `DataStore` shape (`get`/`entries` return the full
  // `{ id, data, digest }` entry, not just `data`) - the loader relies on
  // that to snapshot/reuse previous entries across syncs.
  const stored = new Map<string, { id: string; data: unknown; digest?: string | number }>();
  return {
    store: {
      clear: () => stored.clear(),
      set: (entry: { id: string; data: unknown; digest?: string | number }) => stored.set(entry.id, entry),
      get: (id: string) => stored.get(id),
      entries: () => [...stored.entries()],
      keys: () => stored.keys(),
      delete: (id: string) => stored.delete(id),
    },
    logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
    config: { root },
    generateDigest: (data: unknown) => JSON.stringify(data),
    parseData: vi.fn(async ({ data }: { data: unknown }) => data),
    collection: "icons",
    ...overrides,
  } as any;
}

describe("localIcons / initial sync", () => {
  it("loads every .svg under the directory", async () => {
    await write("home.svg", SQUARE_SVG);
    await write("logos/deno.svg", SQUARE_SVG);

    const loader = localIcons("icons");
    const context = fakeContext();
    await loader.load(context);

    expect([...context.store.keys()].sort()).toEqual(["home", "logos/deno"]);
    expect(recordCollection).toHaveBeenCalledWith(
      root,
      "build",
      "icons",
      expect.arrayContaining(["home", "logos/deno"]),
    );
  });

  it("exposes a default schema", () => {
    expect(localIcons("icons").schema).toBeDefined();
  });

  it("warns instead of throwing when the directory doesn't exist", async () => {
    const loader = localIcons("does-not-exist");
    const context = fakeContext();

    await loader.load(context);

    expect(context.logger.warn).toHaveBeenCalled();
    expect([...context.store.keys()]).toEqual([]);
  });
});

describe("localIcons / incremental watching", () => {
  it("adds a new icon on 'add' without touching existing entries", async () => {
    await write("home.svg", SQUARE_SVG);

    const loader = localIcons("icons");
    const watcher = fakeWatcher();
    const context = fakeContext({ watcher });
    await loader.load(context);

    expect(watcher.add).toHaveBeenCalledWith(join(dir, "icons") + "/");
    expect([...context.store.keys()]).toEqual(["home"]);

    await write("menu.svg", SQUARE_SVG);
    watcher.emit("add", join(dir, "icons", "menu.svg"));

    await vi.waitFor(() => {
      expect([...context.store.keys()].sort()).toEqual(["home", "menu"]);
    });
  });

  it("reloads a changed icon's contents on 'change'", async () => {
    await write("home.svg", SQUARE_SVG);

    const loader = localIcons("icons");
    const watcher = fakeWatcher();
    const context = fakeContext({ watcher });
    await loader.load(context);

    const updated = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle r="16"/></svg>`;
    await write("home.svg", updated);
    watcher.emit("change", join(dir, "icons", "home.svg"));

    await vi.waitFor(() => {
      expect((context.store.get("home") as any).data.viewBox).toBe("0 0 32 32");
    });
  });

  it("removes an icon on 'unlink'", async () => {
    await write("home.svg", SQUARE_SVG);
    await write("menu.svg", SQUARE_SVG);

    const loader = localIcons("icons");
    const watcher = fakeWatcher();
    const context = fakeContext({ watcher });
    await loader.load(context);
    expect([...context.store.keys()].sort()).toEqual(["home", "menu"]);

    watcher.emit("unlink", join(dir, "icons", "menu.svg"));

    await vi.waitFor(() => {
      expect([...context.store.keys()]).toEqual(["home"]);
    });
  });

  it("ignores events for files outside the watched directory", async () => {
    await write("home.svg", SQUARE_SVG);

    const loader = localIcons("icons");
    const watcher = fakeWatcher();
    const context = fakeContext({ watcher });
    await loader.load(context);

    watcher.emit("add", "/some/unrelated/file.svg");
    await Promise.resolve();
    await Promise.resolve();

    expect([...context.store.keys()]).toEqual(["home"]);
  });

  it("ignores non-.svg files inside the watched directory", async () => {
    await write("home.svg", SQUARE_SVG);

    const loader = localIcons("icons");
    const watcher = fakeWatcher();
    const context = fakeContext({ watcher });
    await loader.load(context);

    watcher.emit("add", join(dir, "icons", "readme.md"));
    await Promise.resolve();
    await Promise.resolve();

    expect([...context.store.keys()]).toEqual(["home"]);
  });
});

describe("localIcons / missing directory doesn't destabilize the watcher", () => {
  it("still watches the configured dir (so it recovers if created later), warning exactly once", async () => {
    const loader = localIcons("does-not-exist");
    const watcher = fakeWatcher();
    const context = fakeContext({ watcher });

    await loader.load(context);

    expect(watcher.add).toHaveBeenCalledWith(join(dir, "does-not-exist") + "/");
    expect(context.logger.warn).toHaveBeenCalledTimes(1);
  });

  // Node's EventEmitter throws synchronously when an "error" event has no
  // listener. `watcher` here is a plain EventEmitter standing in for
  // chokidar/Astro's shared dev-server watcher, which emits "error" for fs
  // errors it can't treat as "not there yet" (e.g. EPERM/EACCES, common on
  // Windows when a directory is mid-delete). Without a listener, this
  // `.emit()` call itself throws - taking down the shared watcher (and with
  // it, live reload for every other file, CSS included). This is a regression
  // test for https://github.com/natemoo-re/astro-icon/issues/260.
  it("doesn't crash when the watcher emits 'error' for the missing directory", async () => {
    const loader = localIcons("does-not-exist");
    const watcher = fakeWatcher();
    const context = fakeContext({ watcher });
    await loader.load(context);

    expect(() => {
      watcher.emit("error", new Error("EPERM: operation not permitted, lstat 'does-not-exist'"));
    }).not.toThrow();

    expect(context.logger.warn).toHaveBeenCalledWith(expect.stringContaining("EPERM"));
  });

  it("keeps handling events for unrelated files after an 'error' event", async () => {
    await write("home.svg", SQUARE_SVG);

    const loader = localIcons("icons");
    const watcher = fakeWatcher();
    const context = fakeContext({ watcher });
    await loader.load(context);

    watcher.emit("error", new Error("EPERM: transient error"));

    await write("menu.svg", SQUARE_SVG);
    watcher.emit("add", join(dir, "icons", "menu.svg"));

    await vi.waitFor(() => {
      expect([...context.store.keys()].sort()).toEqual(["home", "menu"]);
    });
  });
});

describe("localIcons / re-sync caching", () => {
  it("skips re-optimizing an icon whose source file hasn't changed", async () => {
    await write("home.svg", SQUARE_SVG);
    await write("logos/deno.svg", SQUARE_SVG);

    const optimize = vi.fn((svg: string) => svg);
    const loader = localIcons("icons", { optimize });
    const context = fakeContext();

    await loader.load(context);
    expect(optimize).toHaveBeenCalledTimes(2);

    // Re-sync with no source changes - as if the process restarted with a
    // persisted content-layer cache, or the loader ran again in the same
    // session. Neither icon's file changed, so `optimize` shouldn't run again.
    await loader.load(context);
    expect(optimize).toHaveBeenCalledTimes(2);
    expect([...context.store.keys()].sort()).toEqual(["home", "logos/deno"]);
  });

  it("re-optimizes only the icon whose source file actually changed", async () => {
    await write("home.svg", SQUARE_SVG);
    await write("logos/deno.svg", SQUARE_SVG);

    const optimize = vi.fn((svg: string) => svg);
    const loader = localIcons("icons", { optimize });
    const context = fakeContext();

    await loader.load(context);
    expect(optimize).toHaveBeenCalledTimes(2);

    const updated = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle r="16"/></svg>`;
    await write("home.svg", updated);

    await loader.load(context);
    expect(optimize).toHaveBeenCalledTimes(3);
    expect((context.store.get("home") as any).data.viewBox).toBe("0 0 32 32");
  });
});

describe("localIcons / timing logs", () => {
  it("logs a duration + count summary at info level after the initial sync", async () => {
    await write("home.svg", SQUARE_SVG);
    await write("logos/deno.svg", SQUARE_SVG);

    const loader = localIcons("icons");
    const context = fakeContext();

    await loader.load(context);

    expect(context.logger.info).toHaveBeenCalledOnce();
    const [message] = context.logger.info.mock.calls[0];
    expect(message).toMatch(/^Loaded 2 icon\(s\) from "icons" in /);
    expect(message).toMatch(/\d+(ms|\.\d\ds)/);
  });
});
