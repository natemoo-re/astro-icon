import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTypegenRecorder, recordCollection } from "../src/content/typegen/index.js";
import { consoleLogger } from "../src/content/logger.js";

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, writeFile: vi.fn(actual.writeFile) };
});

const mockedWriteFile = vi.mocked(writeFile);

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

function readPartial(kind: "build" | "live" | "packs", collection: string) {
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
    expect(build).toContain("interface Collections");
    expect(live).toContain("interface LiveCollections");
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

describe("createTypegenRecorder", () => {
  it("doesn't let one rejected write block a later, unrelated write", async () => {
    const recorder = createTypegenRecorder();
    mockedWriteFile.mockRejectedValueOnce(new Error("EACCES: read-only .astro/"));

    await recorder.recordCollection(root, "build", "mdi", ["search"]);
    await recorder.recordCollection(root, "build", "ri", ["home"]);

    const ri = await readPartial("build", "ri");
    expect(ri).toContain('"ri": "home";');
  });

  it("warns once per instance on a rejected write, not once per failure", async () => {
    const recorder = createTypegenRecorder();
    const warn = vi.spyOn(consoleLogger, "warn").mockImplementation(() => {});
    try {
      mockedWriteFile.mockRejectedValueOnce(new Error("fail 1"));
      mockedWriteFile.mockRejectedValueOnce(new Error("fail 2"));

      await recorder.recordCollection(root, "build", "a", ["x"]);
      await recorder.recordCollection(root, "build", "b", ["y"]);

      expect(warn).toHaveBeenCalledOnce();
    } finally {
      warn.mockRestore();
    }
  });

  it("never rejects the caller, even when the underlying write fails", async () => {
    const recorder = createTypegenRecorder();
    mockedWriteFile.mockRejectedValueOnce(new Error("EACCES"));

    await expect(
      recorder.recordCollection(root, "build", "mdi", ["search"]),
    ).resolves.toBeUndefined();
  });

  it("dedupes an identical catalog record for the same root+pack", async () => {
    const recorder = createTypegenRecorder();
    await recorder.recordCatalog(root, "mdi", ["search"]);
    const before = await readPartial("packs", "mdi");

    mockedWriteFile.mockClear();
    await recorder.recordCatalog(root, "mdi", ["search", "menu"]);

    expect(mockedWriteFile).not.toHaveBeenCalled();
    const after = await readPartial("packs", "mdi");
    expect(after).toBe(before);
  });

  it("records a catalog separately per root, even for the same pack name", async () => {
    const otherDir = await mkdtemp(join(tmpdir(), "astro-icon-typegen-"));
    const otherRoot = new URL(`file://${otherDir}/`);
    try {
      const recorder = createTypegenRecorder();
      await recorder.recordCatalog(root, "mdi", ["search"]);
      await recorder.recordCatalog(otherRoot, "mdi", ["menu"]);

      const first = await readFile(
        new URL("./.astro/astro-icon/packs-mdi.d.ts", root),
        "utf-8",
      );
      const second = await readFile(
        new URL("./.astro/astro-icon/packs-mdi.d.ts", otherRoot),
        "utf-8",
      );
      expect(first).toContain('"mdi": "search";');
      expect(second).toContain('"mdi": "menu";');
    } finally {
      await rm(otherDir, { recursive: true, force: true });
    }
  });
});
