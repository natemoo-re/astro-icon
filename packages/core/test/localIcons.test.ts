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
  const stored = new Map<string, unknown>();
  return {
    store: {
      clear: () => stored.clear(),
      set: (entry: { id: string; data: unknown }) => stored.set(entry.id, entry.data),
      get: (id: string) => stored.get(id),
      keys: () => stored.keys(),
      delete: (id: string) => stored.delete(id),
    },
    logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
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
      expect((context.store.get("home") as any).viewBox).toBe("0 0 32 32");
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
