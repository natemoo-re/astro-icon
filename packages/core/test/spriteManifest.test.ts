import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  readSpriteAssets,
  readSpriteManifest,
  recordSprite,
} from "../src/content/sprite/manifest.js";

let dir: string;
let root: URL;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "astro-icon-sprite-"));
  root = new URL(`file://${dir}/`);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function sprited(hash: string, assetContent = `<svg>${hash}</svg>`) {
  return { sprite: true as const, hash, assetContent };
}

describe("recordSprite + readSpriteManifest", () => {
  it("produces no manifest entry when nothing has been recorded", async () => {
    expect(await readSpriteManifest(root)).toEqual({});
  });

  it("records a sprited collection and produces a manifest entry for it", async () => {
    await recordSprite(root, "mdi", sprited("abc123"));
    const manifest = await readSpriteManifest(root);
    expect(manifest).toHaveProperty("mdi");
    expect(manifest.mdi).toEqual({ hash: "abc123", assetIcons: "all" });
  });

  it("omits a collection recorded with sprite: false", async () => {
    await recordSprite(root, "mdi", { sprite: false });
    expect(await readSpriteManifest(root)).toEqual({});
  });

  it("keeps unrelated collections independent", async () => {
    await recordSprite(root, "mdi", sprited("abc123"));
    await recordSprite(root, "icons", { sprite: false });
    const manifest = await readSpriteManifest(root);
    expect(manifest).toHaveProperty("mdi");
    expect(manifest).not.toHaveProperty("icons");
  });

  it("re-recording a collection overwrites its previous state", async () => {
    await recordSprite(root, "mdi", sprited("abc123"));
    await recordSprite(root, "mdi", { sprite: false });
    expect(await readSpriteManifest(root)).toEqual({});
  });

  it("serializes concurrent writes instead of racing on the shared state file", async () => {
    await Promise.all([
      recordSprite(root, "mdi", sprited("a1")),
      recordSprite(root, "icons", sprited("a2")),
      recordSprite(root, "ri", sprited("a3")),
    ]);
    const manifest = await readSpriteManifest(root);
    expect(Object.keys(manifest).sort()).toEqual(["icons", "mdi", "ri"]);
  });
});

describe("readSpriteAssets", () => {
  it("returns nothing when nothing has been recorded", async () => {
    expect(await readSpriteAssets(root)).toEqual([]);
  });

  it("returns the staged content for every sprited collection", async () => {
    await recordSprite(
      root,
      "mdi",
      sprited("abc123", "<svg>mdi content</svg>"),
    );
    const assets = await readSpriteAssets(root);
    expect(assets).toEqual([
      { collection: "mdi", hash: "abc123", content: "<svg>mdi content</svg>" },
    ]);
  });

  it("excludes a collection recorded with sprite: false - it never had an asset staged", async () => {
    await recordSprite(root, "mdi", sprited("abc123"));
    await recordSprite(root, "icons", { sprite: false });
    const assets = await readSpriteAssets(root);
    expect(assets.map((a) => a.collection)).toEqual(["mdi"]);
  });

  it("reflects a re-recorded collection's latest content, not a stale copy", async () => {
    await recordSprite(root, "mdi", sprited("v1", "<svg>old</svg>"));
    await recordSprite(root, "mdi", sprited("v2", "<svg>new</svg>"));
    const assets = await readSpriteAssets(root);
    expect(assets).toEqual([
      { collection: "mdi", hash: "v2", content: "<svg>new</svg>" },
    ]);
  });
});
