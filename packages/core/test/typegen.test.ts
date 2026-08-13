import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { recordCollection } from "../src/content/typegen/index.js";

let dir: string;
let root: URL;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "astro-icon-typegen-"));
  root = new URL(`file://${dir}/`);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function readIndex() {
  return readFile(new URL("./.astro/astro-icon.d.ts", root), "utf-8");
}

function readPartial(kind: "build" | "live", collection: string) {
  return readFile(
    new URL(`./.astro/astro-icon/${kind}-${collection}.d.ts`, root),
    "utf-8",
  );
}

describe("recordCollection", () => {
  it("writes a per-collection declaration file with a union of its names", async () => {
    await recordCollection(root, "build", "mdi", ["search", "menu"]);
    const partial = await readPartial("build", "mdi");
    expect(partial).toContain('"mdi": "search" | "menu";');
  });

  it("references every known collection's file from the index", async () => {
    await recordCollection(root, "build", "mdi", ["search"]);
    await recordCollection(root, "build", "ri", ["home"]);
    const index = await readIndex();
    expect(index).toContain('reference path="./astro-icon/build-mdi.d.ts"');
    expect(index).toContain('reference path="./astro-icon/build-ri.d.ts"');
  });

  it("doesn't drop another collection's file when one is re-recorded", async () => {
    await recordCollection(root, "build", "mdi", ["search"]);
    await recordCollection(root, "build", "ri", ["home"]);
    await recordCollection(root, "build", "mdi", ["search", "menu"]);

    const mdi = await readPartial("build", "mdi");
    const ri = await readPartial("build", "ri");
    const index = await readIndex();
    expect(mdi).toContain('"mdi": "search" | "menu";');
    expect(ri).toContain('"ri": "home";');
    expect(index).toContain('reference path="./astro-icon/build-mdi.d.ts"');
    expect(index).toContain('reference path="./astro-icon/build-ri.d.ts"');
  });

  it("falls back to a plain string type for a live collection with no known names", async () => {
    await recordCollection(root, "live", "mdi", []);
    const partial = await readPartial("live", "mdi");
    expect(partial).toContain('"mdi": string;');
  });

  it("types a live collection as a union when its source could list its names", async () => {
    // A live source backed by a locally-installed pack (or anything else
    // that can enumerate itself via `listIcons()`) should get real
    // autocomplete, not just `string`.
    await recordCollection(root, "live", "mdi", ["search", "menu"]);
    const partial = await readPartial("live", "mdi");
    expect(partial).toContain('"mdi": "search" | "menu";');
  });

  it("keeps a build and a live collection with the same name in separate files", async () => {
    await recordCollection(root, "build", "mdi", ["search"]);
    await recordCollection(root, "live", "mdi", []);

    const build = await readPartial("build", "mdi");
    const live = await readPartial("live", "mdi");
    expect(build).toContain('interface Collections');
    expect(live).toContain('interface LiveCollections');
  });

  it("skips rewriting a collection's file when its content hash is unchanged", async () => {
    await recordCollection(root, "build", "mdi", ["search"]);
    const before = await readPartial("build", "mdi");
    await recordCollection(root, "build", "mdi", ["search"]);
    const after = await readPartial("build", "mdi");
    expect(after).toBe(before);
  });

  it("sanitizes a collection name that isn't filesystem-safe", async () => {
    await recordCollection(root, "build", "my icons!", ["search"]);
    const partial = await readPartial("build", "my_icons_");
    expect(partial).toContain('"my icons!": "search";');
  });
});
