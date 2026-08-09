import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { localSource } from "../src/local/localSource.js";

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

    await expect(source.listIcons?.()).resolves.toEqual(["logo", "not-on-disk"]);
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

  it("throws a descriptive error for a missing file", async () => {
    const source = localSource(dir);
    await expect(source.getIcon("nope")).rejects.toThrow(/no local icon file/i);
  });

  it("rejects a name outside an explicit allowlist without touching the filesystem", async () => {
    await write("logo.svg", SQUARE_SVG);
    const source = localSource(dir, { icons: ["logo"] });

    await expect(source.getIcon("other")).rejects.toThrow(/isn't in the allowed/i);
  });

  it("accepts a file:// URL for the directory, same as a plain path", async () => {
    await write("logo.svg", SQUARE_SVG);
    const source = localSource(new URL(`file://${dir}/`));

    await expect(source.getIcon("logo")).resolves.toMatchObject({ viewBox: "0 0 24 24" });
  });
});
