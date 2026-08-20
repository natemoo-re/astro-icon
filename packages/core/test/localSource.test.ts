import { EventEmitter } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localSource } from "../src/content/local/source.js";
import type { IconChangeEvent } from "../src/content/source.js";

const SQUARE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24"/></svg>`;

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "astro-icon-local-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function write(relativePath: string, content: string) {
  const full = join(dir, relativePath);
  await mkdir(join(full, ".."), { recursive: true });
  await writeFile(full, content);
}

describe("localSource / listIcons", () => {
  it("lists top-level .svg files by their name, without the extension", async () => {
    await write("logo.svg", SQUARE_SVG);
    await write("readme.md", "not an icon");

    const source = localSource(dir);
    await expect(source.listIcons?.()).resolves.toEqual(["logo"]);
  });

  it("uses '/' to join a subdirectory into the icon name", async () => {
    await write("logos/deno.svg", SQUARE_SVG);
    await write("logos/alpine.svg", SQUARE_SVG);

    const source = localSource(dir);
    const names = await source.listIcons?.();
    expect(names).toContain("logos/deno");
    expect(names).toContain("logos/alpine");
  });

  it("returns an empty list for a directory that doesn't exist", async () => {
    const source = localSource(join(dir, "does-not-exist"));
    await expect(source.listIcons?.()).resolves.toEqual([]);
  });

  it("types exactly the given allowlist instead of walking the directory", async () => {
    await write("logo.svg", SQUARE_SVG);
    const source = localSource(dir, { icons: ["logo", "not-on-disk"] });

    await expect(source.listIcons?.()).resolves.toEqual([
      "logo",
      "not-on-disk",
    ]);
  });
});

describe("localSource / getIcon", () => {
  it("reads and parses a top-level icon file", async () => {
    await write("logo.svg", SQUARE_SVG);
    const source = localSource(dir);

    const entry = await source.getIcon("logo");
    expect(entry.viewBox).toBe("0 0 24 24");
    expect(entry.body).toContain("<rect");
  });

  it("reads an icon nested in a subdirectory by its joined name", async () => {
    await write("logos/deno.svg", SQUARE_SVG);
    const source = localSource(dir);

    const entry = await source.getIcon("logos/deno");
    expect(entry.viewBox).toBe("0 0 24 24");
  });

  it('stores fill/stroke set on the root <svg> tag (the Heroicons "stroke icon" pattern) as entry fields, not wrapped into body', async () => {
    await write(
      "adjustment.svg",
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 6V4"/></svg>`,
    );
    const source = localSource(dir);

    const entry = await source.getIcon("adjustment");
    expect(entry.fill).toBe("none");
    expect(entry.stroke).toBe("currentColor");
    // Not baked into body: an inner element's own fill/stroke would always beat whatever a
    // caller's <Icon fill="..." /> prop sets on the outer <svg>, silently defeating the override.
    expect(entry.body).toBe('<path d="M12 6V4"/>');
  });

  it("pulls an icon's own inline <title>/<desc> into entry.title/entry.desc, stripped from body", async () => {
    await write(
      "adjustment.svg",
      `<svg viewBox="0 0 24 24"><title>Adjustment</title><desc>An adjustment icon</desc><path d="M12 6V4"/></svg>`,
    );
    const source = localSource(dir);

    const entry = await source.getIcon("adjustment");
    expect(entry.title).toBe("Adjustment");
    expect(entry.desc).toBe("An adjustment icon");
    expect(entry.body).toBe('<path d="M12 6V4"/>');
  });

  it("leaves entry.title/entry.desc unset when the icon has no inline <title>/<desc>", async () => {
    await write("home.svg", SQUARE_SVG);
    const source = localSource(dir);

    const entry = await source.getIcon("home");
    expect(entry.title).toBeUndefined();
    expect(entry.desc).toBeUndefined();
  });

  it("throws a descriptive error for a missing file", async () => {
    const source = localSource(dir);
    await expect(source.getIcon("nope")).rejects.toThrow(/no local icon file/i);
  });

  it("rejects a name outside an explicit allowlist without touching the filesystem", async () => {
    await write("logo.svg", SQUARE_SVG);
    const source = localSource(dir, { icons: ["logo"] });

    await expect(source.getIcon("other")).rejects.toThrow(
      /isn't in the allowed/i,
    );
  });

  it("accepts a file:// URL for the directory, same as a plain path", async () => {
    await write("logo.svg", SQUARE_SVG);
    const source = localSource(new URL(`file://${dir}/`));

    await expect(source.getIcon("logo")).resolves.toMatchObject({
      viewBox: "0 0 24 24",
    });
  });

  it("skips re-running optimize when the file's content hash hasn't changed between calls", async () => {
    await write("logo.svg", SQUARE_SVG);
    const optimize = vi.fn((svg: string) => svg);
    const source = localSource(dir, { optimize });

    await source.getIcon("logo");
    await source.getIcon("logo");
    expect(optimize).toHaveBeenCalledTimes(1);
  });

  it("re-runs optimize once the file's content actually changes", async () => {
    await write("logo.svg", SQUARE_SVG);
    const optimize = vi.fn((svg: string) => svg);
    const source = localSource(dir, { optimize });
    await source.getIcon("logo");

    await write("logo.svg", `<svg viewBox="0 0 32 32"><circle r="16"/></svg>`);
    const entry = await source.getIcon("logo");

    expect(optimize).toHaveBeenCalledTimes(2);
    expect(entry.viewBox).toBe("0 0 32 32");
  });
});

describe("localSource / getVersion", () => {
  it("reports the same version when nothing on disk has changed", async () => {
    await write("logo.svg", SQUARE_SVG);
    const source = localSource(dir);

    await expect(source.getVersion?.()).resolves.toEqual(
      await source.getVersion?.(),
    );
  });

  it("reports a different version once a file's mtime/size changes", async () => {
    await write("logo.svg", SQUARE_SVG);
    const source = localSource(dir);
    const before = await source.getVersion?.();

    await write("logo.svg", `<svg viewBox="0 0 32 32"><circle r="16"/></svg>`);
    const after = await source.getVersion?.();

    expect(after).not.toEqual(before);
  });
});

function fakeWatcher() {
  const emitter = new EventEmitter();
  return Object.assign(emitter, { add: vi.fn() });
}

describe("localSource / watch", () => {
  it("registers its own directory with the watcher", async () => {
    const source = localSource(dir);
    const watcher = fakeWatcher();

    source.watch?.(watcher, () => {});

    expect(watcher.add).toHaveBeenCalledWith(dir);
  });

  it("reports an add/change/unlink for a .svg file inside its own directory, by icon name", async () => {
    const source = localSource(dir);
    const watcher = fakeWatcher();
    const events: IconChangeEvent[] = [];
    source.watch?.(watcher, (event) => events.push(event));

    watcher.emit("add", join(dir, "logos", "deno.svg"));
    watcher.emit("change", join(dir, "home.svg"));
    watcher.emit("unlink", join(dir, "home.svg"));

    expect(events).toEqual([
      { type: "add", name: "logos/deno" },
      { type: "change", name: "home" },
      { type: "unlink", name: "home" },
    ]);
  });

  it("ignores events for files outside its own directory, or non-.svg files inside it", async () => {
    const source = localSource(dir);
    const watcher = fakeWatcher();
    const events: IconChangeEvent[] = [];
    source.watch?.(watcher, (event) => events.push(event));

    watcher.emit("add", "/some/unrelated/file.svg");
    watcher.emit("add", join(dir, "readme.md"));

    expect(events).toEqual([]);
  });

  it("doesn't crash when the shared watcher emits 'error'", () => {
    const source = localSource(dir);
    const watcher = fakeWatcher();
    source.watch?.(watcher, () => {});

    expect(() => watcher.emit("error", new Error("EPERM"))).not.toThrow();
  });
});

describe("localSource / missing directory", () => {
  it("warns once, however many times listIcons()/watch() ask", async () => {
    const warn = vi.fn();
    const missing = join(dir, "does-not-exist");
    const source = localSource(missing, { logger: { warn } });

    await source.listIcons?.();
    await source.listIcons?.();
    source.watch?.(fakeWatcher(), () => {});

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("does not exist");
  });

  it("still registers the directory with the watcher, so it recovers once created", () => {
    const missing = join(dir, "does-not-exist");
    const source = localSource(missing);
    const watcher = fakeWatcher();

    source.watch?.(watcher, () => {});

    expect(watcher.add).toHaveBeenCalledWith(missing);
  });
});

describe("localSource / currentColor discoverability nudge", () => {
  it("warns once, naming the icon, the first time a freshly-parsed icon doesn't use currentColor", async () => {
    // No fill attribute at all - relies on SVG's default black, the same shape #136 hit.
    await write("home.svg", SQUARE_SVG);
    const warn = vi.fn();
    const source = localSource(dir, { logger: { warn } });

    await source.getIcon("home");

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"home"'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("currentColor"));
  });

  it("doesn't warn when the icon already uses currentColor", async () => {
    await write(
      "home.svg",
      `<svg viewBox="0 0 24 24"><rect fill="currentColor" width="24" height="24"/></svg>`,
    );
    const warn = vi.fn();
    const source = localSource(dir, { logger: { warn } });

    await source.getIcon("home");

    expect(warn).not.toHaveBeenCalled();
  });

  it("doesn't warn when currentColor is set on the root <svg> tag itself", async () => {
    await write(
      "home.svg",
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M0 0"/></svg>`,
    );
    const warn = vi.fn();
    const source = localSource(dir, { logger: { warn } });

    await source.getIcon("home");

    expect(warn).not.toHaveBeenCalled();
  });

  it("doesn't warn about a multi-color icon (reads as a deliberate graphic, not a miss)", async () => {
    await write(
      "logo.svg",
      `<svg viewBox="0 0 24 24"><rect fill="#ff0000" width="12" height="24"/><rect fill="#0000ff" x="12" width="12" height="24"/></svg>`,
    );
    const warn = vi.fn();
    const source = localSource(dir, { logger: { warn } });

    await source.getIcon("logo");

    expect(warn).not.toHaveBeenCalled();
  });

  it("doesn't re-warn on a cache hit, but does once the content genuinely changes", async () => {
    await write("home.svg", SQUARE_SVG);
    const warn = vi.fn();
    const source = localSource(dir, { logger: { warn } });

    await source.getIcon("home");
    await source.getIcon("home");
    expect(warn).toHaveBeenCalledTimes(1);

    await write(
      "home.svg",
      `<svg viewBox="0 0 24 24"><rect fill="#000" width="24" height="24"/></svg>`,
    );
    await source.getIcon("home");
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe("localSource / resolveRoot", () => {
  it("anchors a relative dir against the given root once resolveRoot() is called", async () => {
    await write("sub/logo.svg", SQUARE_SVG);
    const source = localSource("sub");

    source.resolveRoot?.(new URL(`file://${dir}/`));

    await expect(source.getIcon("logo")).resolves.toMatchObject({
      viewBox: "0 0 24 24",
    });
  });

  it("resolves a relative dir against the process's cwd before resolveRoot() is ever called", async () => {
    await write("sub/logo.svg", SQUARE_SVG);
    const source = localSource("sub");

    // Never anchored to `dir` - "sub" resolves relative to this process's actual cwd, which
    // (assuming the test runner isn't invoked from inside the temp dir) has no such file.
    await expect(source.getIcon("logo")).rejects.toThrow(/no local icon file/i);
  });

  it("leaves a URL dir untouched, ignoring any root it's given", async () => {
    await write("logo.svg", SQUARE_SVG);
    const source = localSource(new URL(`file://${dir}/`));

    source.resolveRoot?.(new URL("file:///somewhere/else/"));

    await expect(source.getIcon("logo")).resolves.toMatchObject({
      viewBox: "0 0 24 24",
    });
  });

  it("leaves an absolute string dir untouched, ignoring any root it's given", async () => {
    await write("logo.svg", SQUARE_SVG);
    const source = localSource(dir);

    source.resolveRoot?.(new URL("file:///somewhere/else/"));

    await expect(source.getIcon("logo")).resolves.toMatchObject({
      viewBox: "0 0 24 24",
    });
  });
});
