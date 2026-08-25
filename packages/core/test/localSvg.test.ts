import { EventEmitter } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localSvg } from "../src/content/local/localSvg.js";
import type { IconChangeEvent, IconSource } from "../src/content/source.js";

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

/** `source.getIcons([name])`, unwrapped to that one name's result - a resolved entry, an `Error`, or `undefined` if it's missing from the map entirely. */
async function getOne(source: IconSource, name: string) {
  const result = await source.getIcons([name]);
  return result.get(name);
}

describe("localSvg / listIcons", () => {
  it("lists top-level .svg files by their name, without the extension", async () => {
    await write("logo.svg", SQUARE_SVG);
    await write("readme.md", "not an icon");

    const source = localSvg(dir);
    await expect(source.listIcons?.()).resolves.toEqual(["logo"]);
  });

  it("uses '/' to join a subdirectory into the icon name", async () => {
    await write("logos/deno.svg", SQUARE_SVG);
    await write("logos/alpine.svg", SQUARE_SVG);

    const source = localSvg(dir);
    const names = await source.listIcons?.();
    expect(names).toContain("logos/deno");
    expect(names).toContain("logos/alpine");
  });

  it("returns an empty list for a directory that doesn't exist", async () => {
    const source = localSvg(join(dir, "does-not-exist"));
    await expect(source.listIcons?.()).resolves.toEqual([]);
  });

  it("types exactly the given allowlist instead of walking the directory", async () => {
    await write("logo.svg", SQUARE_SVG);
    const source = localSvg(dir, { allowed: ["logo", "not-on-disk"] });

    await expect(source.listIcons?.()).resolves.toEqual([
      "logo",
      "not-on-disk",
    ]);
  });
});

describe("localSvg / getIcons", () => {
  it("reads and parses a top-level icon file", async () => {
    await write("logo.svg", SQUARE_SVG);
    const source = localSvg(dir);

    const entry = await getOne(source, "logo");
    expect(entry).toMatchObject({ viewBox: "0 0 24 24" });
    expect((entry as { body: string }).body).toContain("<rect");
  });

  it("reads an icon nested in a subdirectory by its joined name", async () => {
    await write("logos/deno.svg", SQUARE_SVG);
    const source = localSvg(dir);

    await expect(getOne(source, "logos/deno")).resolves.toMatchObject({
      viewBox: "0 0 24 24",
    });
  });

  it("resolves several icons from one getIcons call", async () => {
    await write("logo.svg", SQUARE_SVG);
    await write("home.svg", SQUARE_SVG);
    const source = localSvg(dir);

    const result = await source.getIcons(["logo", "home"]);

    expect(result.get("logo")).toMatchObject({ viewBox: "0 0 24 24" });
    expect(result.get("home")).toMatchObject({ viewBox: "0 0 24 24" });
  });

  it('stores fill/stroke set on the root <svg> tag (the Heroicons "stroke icon" pattern) as entry fields, not wrapped into body', async () => {
    await write(
      "adjustment.svg",
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 6V4"/></svg>`,
    );
    const source = localSvg(dir);

    const entry = await getOne(source, "adjustment");
    expect(entry).toMatchObject({
      fill: "none",
      stroke: "currentColor",
      // Not baked into body: an inner element's own fill/stroke would always beat whatever a
      // caller's <Icon fill="..." /> prop sets on the outer <svg>, silently defeating the override.
      // `/>` -> ` />` is ultrahtml's own serializer normalization, applied once during ingestion.
      body: '<path d="M12 6V4" />',
    });
  });

  it("pulls an icon's own inline <title>/<desc> into entry.title/entry.desc, stripped from body", async () => {
    await write(
      "adjustment.svg",
      `<svg viewBox="0 0 24 24"><title>Adjustment</title><desc>An adjustment icon</desc><path d="M12 6V4"/></svg>`,
    );
    const source = localSvg(dir);

    const entry = await getOne(source, "adjustment");
    expect(entry).toMatchObject({
      title: "Adjustment",
      desc: "An adjustment icon",
      body: '<path d="M12 6V4" />',
    });
  });

  it("leaves entry.title/entry.desc unset when the icon has no inline <title>/<desc>", async () => {
    await write("home.svg", SQUARE_SVG);
    const source = localSvg(dir);

    const entry = await getOne(source, "home");
    expect((entry as { title?: string }).title).toBeUndefined();
    expect((entry as { desc?: string }).desc).toBeUndefined();
  });

  it("puts a descriptive Error in the map for a missing file", async () => {
    const source = localSvg(dir);

    const entry = await getOne(source, "nope");
    expect(entry).toBeInstanceOf(Error);
    expect((entry as Error).message).toMatch(/no local icon file/i);
  });

  it("puts an Error in the map for a name outside an explicit allowlist, without touching the filesystem", async () => {
    await write("logo.svg", SQUARE_SVG);
    const source = localSvg(dir, { allowed: ["logo"] });

    const entry = await getOne(source, "other");
    expect(entry).toBeInstanceOf(Error);
    expect((entry as Error).message).toMatch(/isn't in the allowed/i);
  });

  it("accepts a file:// URL for the directory, same as a plain path", async () => {
    await write("logo.svg", SQUARE_SVG);
    const source = localSvg(new URL(`file://${dir}/`));

    await expect(getOne(source, "logo")).resolves.toMatchObject({
      viewBox: "0 0 24 24",
    });
  });

  it("skips re-running optimize when the file's content hash hasn't changed between calls", async () => {
    await write("logo.svg", SQUARE_SVG);
    const optimize = vi.fn((svg: string) => svg);
    const source = localSvg(dir, { optimize });

    await getOne(source, "logo");
    await getOne(source, "logo");
    expect(optimize).toHaveBeenCalledTimes(1);
  });

  it("re-runs optimize once the file's content actually changes", async () => {
    await write("logo.svg", SQUARE_SVG);
    const optimize = vi.fn((svg: string) => svg);
    const source = localSvg(dir, { optimize });
    await getOne(source, "logo");

    await write("logo.svg", `<svg viewBox="0 0 32 32"><circle r="16"/></svg>`);
    const entry = await getOne(source, "logo");

    expect(optimize).toHaveBeenCalledTimes(2);
    expect(entry).toMatchObject({ viewBox: "0 0 32 32" });
  });
});

describe("localSvg / viewBox derivation warning", () => {
  it("warns, naming the file's directory, when a viewBox has to be derived", async () => {
    await write(
      "logo.svg",
      `<svg width="32" height="32"><rect width="32" height="32"/></svg>`,
    );
    const warn = vi.fn();
    const source = localSvg(dir, { logger: { warn } });

    const entry = await getOne(source, "logo");

    expect(entry).toMatchObject({ viewBox: "0 0 32 32" });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"logo"'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(dir));
  });

  it("doesn't warn when the file has a usable viewBox", async () => {
    // currentColor set, so the unrelated "doesn't use currentColor" nudge can't fire either.
    await write(
      "logo.svg",
      `<svg viewBox="0 0 24 24" fill="currentColor"><rect width="24" height="24"/></svg>`,
    );
    const warn = vi.fn();
    const source = localSvg(dir, { logger: { warn } });

    await getOne(source, "logo");

    expect(warn).not.toHaveBeenCalled();
  });
});

describe("localSvg / transform", () => {
  it("applies transform to the built entry, after optimize, before it's returned", async () => {
    await write(
      "search.svg",
      `<svg viewBox="0 0 24 24"><path stroke-width="2" d="M10 10h4v4h-4z"/></svg>`,
    );
    const source = localSvg(dir, {
      transform: (entry) => ({
        ...entry,
        body: entry.body.replaceAll('stroke-width="2"', 'stroke-width="1.5"'),
      }),
    });

    const entry = await getOne(source, "search");

    expect((entry as { body: string }).body).toContain('stroke-width="1.5"');
  });

  it("passes the built entry and { collection, name } context to transform", async () => {
    await write("search.svg", SQUARE_SVG);
    const transform = vi.fn((entry) => entry);
    const source = localSvg(dir, { transform });

    await getOne(source, "search");

    expect(transform).toHaveBeenCalledWith(
      expect.objectContaining({ viewBox: "0 0 24 24" }),
      { collection: "local", name: "search" },
    );
  });

  it("runs transform after optimize, so it sees optimize's output", async () => {
    await write("search.svg", SQUARE_SVG);
    const source = localSvg(dir, {
      optimize: (svg) => svg.replace("<rect", '<rect fill="red"'),
      transform: (entry) => ({
        ...entry,
        body: entry.body.includes('fill="red"')
          ? entry.body.replace('fill="red"', 'fill="currentColor"')
          : entry.body,
      }),
    });

    const entry = await getOne(source, "search");

    expect((entry as { body: string }).body).toContain('fill="currentColor"');
  });
});

describe("localSvg / getVersion", () => {
  it("reports the same version when nothing on disk has changed", async () => {
    await write("logo.svg", SQUARE_SVG);
    const source = localSvg(dir);

    await expect(source.getVersion?.()).resolves.toEqual(
      await source.getVersion?.(),
    );
  });

  it("reports a different version once a file's mtime/size changes", async () => {
    await write("logo.svg", SQUARE_SVG);
    const source = localSvg(dir);
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

describe("localSvg / watch", () => {
  it("registers its own directory with the watcher", async () => {
    const source = localSvg(dir);
    const watcher = fakeWatcher();

    source.watch?.(watcher, () => {});

    expect(watcher.add).toHaveBeenCalledWith(dir);
  });

  it("reports an add/change/unlink for a .svg file inside its own directory, by icon name", async () => {
    const source = localSvg(dir);
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
    const source = localSvg(dir);
    const watcher = fakeWatcher();
    const events: IconChangeEvent[] = [];
    source.watch?.(watcher, (event) => events.push(event));

    watcher.emit("add", "/some/unrelated/file.svg");
    watcher.emit("add", join(dir, "readme.md"));

    expect(events).toEqual([]);
  });

  it("doesn't crash when the shared watcher emits 'error'", () => {
    const source = localSvg(dir);
    const watcher = fakeWatcher();
    source.watch?.(watcher, () => {});

    expect(() => watcher.emit("error", new Error("EPERM"))).not.toThrow();
  });
});

describe("localSvg / missing directory", () => {
  it("warns once, however many times listIcons()/watch() ask", async () => {
    const warn = vi.fn();
    const missing = join(dir, "does-not-exist");
    const source = localSvg(missing, { logger: { warn } });

    await source.listIcons?.();
    await source.listIcons?.();
    source.watch?.(fakeWatcher(), () => {});

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("does not exist");
  });

  it("still registers the directory with the watcher, so it recovers once created", () => {
    const missing = join(dir, "does-not-exist");
    const source = localSvg(missing);
    const watcher = fakeWatcher();

    source.watch?.(watcher, () => {});

    expect(watcher.add).toHaveBeenCalledWith(missing);
  });
});

describe("localSvg / currentColor discoverability nudge", () => {
  it("warns once, naming the icon, the first time a freshly-parsed icon doesn't use currentColor", async () => {
    // No fill attribute at all - relies on SVG's default black, the same shape #136 hit.
    await write("home.svg", SQUARE_SVG);
    const warn = vi.fn();
    const source = localSvg(dir, { logger: { warn } });

    await getOne(source, "home");

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"home"'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("currentColor"));
  });

  it("doesn't warn when the icon already uses currentColor", async () => {
    await write(
      "home.svg",
      `<svg viewBox="0 0 24 24"><rect fill="currentColor" width="24" height="24"/></svg>`,
    );
    const warn = vi.fn();
    const source = localSvg(dir, { logger: { warn } });

    await getOne(source, "home");

    expect(warn).not.toHaveBeenCalled();
  });

  it("doesn't warn when currentColor is set on the root <svg> tag itself", async () => {
    await write(
      "home.svg",
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M0 0"/></svg>`,
    );
    const warn = vi.fn();
    const source = localSvg(dir, { logger: { warn } });

    await getOne(source, "home");

    expect(warn).not.toHaveBeenCalled();
  });

  it("doesn't warn about a multi-color icon (reads as a deliberate graphic, not a miss)", async () => {
    await write(
      "logo.svg",
      `<svg viewBox="0 0 24 24"><rect fill="#ff0000" width="12" height="24"/><rect fill="#0000ff" x="12" width="12" height="24"/></svg>`,
    );
    const warn = vi.fn();
    const source = localSvg(dir, { logger: { warn } });

    await getOne(source, "logo");

    expect(warn).not.toHaveBeenCalled();
  });

  it("names the icon directory as the original relative string passed in, not the resolved absolute path", async () => {
    await write("icons/home.svg", SQUARE_SVG);
    const warn = vi.fn();
    const source = localSvg("icons", { logger: { warn } });
    source.resolveRoot?.(new URL(`file://${dir}/`));

    await getOne(source, "home");

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"icons"'));
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining(dir));
  });

  it("falls back to the resolved absolute path for a URL dir - a raw file:// string wouldn't be any more readable", async () => {
    await write("home.svg", SQUARE_SVG);
    const warn = vi.fn();
    const source = localSvg(new URL(`file://${dir}/`), { logger: { warn } });

    await getOne(source, "home");

    expect(warn).toHaveBeenCalledWith(expect.stringContaining(dir));
  });

  it("doesn't re-warn on a cache hit, but does once the content genuinely changes", async () => {
    await write("home.svg", SQUARE_SVG);
    const warn = vi.fn();
    const source = localSvg(dir, { logger: { warn } });

    await getOne(source, "home");
    await getOne(source, "home");
    expect(warn).toHaveBeenCalledTimes(1);

    await write(
      "home.svg",
      `<svg viewBox="0 0 24 24"><rect fill="#000" width="24" height="24"/></svg>`,
    );
    await getOne(source, "home");
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe("localSvg / resolveRoot", () => {
  it("anchors a relative dir against the given root once resolveRoot() is called", async () => {
    await write("sub/logo.svg", SQUARE_SVG);
    const source = localSvg("sub");

    source.resolveRoot?.(new URL(`file://${dir}/`));

    await expect(getOne(source, "logo")).resolves.toMatchObject({
      viewBox: "0 0 24 24",
    });
  });

  it("resolves a relative dir against the process's cwd before resolveRoot() is ever called", async () => {
    await write("sub/logo.svg", SQUARE_SVG);
    const source = localSvg("sub");

    // Never anchored to `dir` - "sub" resolves relative to this process's actual cwd, which
    // (assuming the test runner isn't invoked from inside the temp dir) has no such file.
    const entry = await getOne(source, "logo");
    expect(entry).toBeInstanceOf(Error);
    expect((entry as Error).message).toMatch(/no local icon file/i);
  });

  it("leaves a URL dir untouched, ignoring any root it's given", async () => {
    await write("logo.svg", SQUARE_SVG);
    const source = localSvg(new URL(`file://${dir}/`));

    source.resolveRoot?.(new URL("file:///somewhere/else/"));

    await expect(getOne(source, "logo")).resolves.toMatchObject({
      viewBox: "0 0 24 24",
    });
  });

  it("leaves an absolute string dir untouched, ignoring any root it's given", async () => {
    await write("logo.svg", SQUARE_SVG);
    const source = localSvg(dir);

    source.resolveRoot?.(new URL("file:///somewhere/else/"));

    await expect(getOne(source, "logo")).resolves.toMatchObject({
      viewBox: "0 0 24 24",
    });
  });
});
