import { readFile, writeFile } from "node:fs/promises";
import type { SpriteManifest } from "../../internal/spriteManifest.js";
import {
  ensureDir,
  readSpriteState,
  spritePaths,
  writeSpriteState,
} from "./state.js";

// Serializes concurrent writes from multiple loaders running in the same sync.
let chain: Promise<void> = Promise.resolve();

export interface RecordSpriteOptions {
  sprite: boolean;
  /** Content-addressed hash of this sync's built icons. Required when `sprite` is true - a sprited collection always has something to hash. */
  hash?: string;
  /** The rendered sprite asset's SVG content, staged to disk here so the integration can serve/emit it without needing to re-read the content store later. */
  assetContent?: string;
}

/**
 * Records a collection's sprite state - preference, content hash, and
 * (staged to disk) the rendered asset - regardless of whether the sprite
 * integration is installed. Cheap to record; reading it back (via
 * {@link readSpriteManifest} and {@link readSpriteAssets}) is entirely the
 * integration's job. No integration installed means nothing ever reads this
 * state, so `<Icon>` finds no manifest entry for any collection and renders
 * plain inline `<svg>` everywhere - what's recorded here is inert until
 * then.
 */
export function recordSprite(
  rootDir: URL,
  collection: string,
  options: RecordSpriteOptions,
): Promise<void> {
  chain = chain.then(() => updateState(rootDir, collection, options));
  return chain;
}

async function updateState(
  rootDir: URL,
  collection: string,
  { sprite, hash, assetContent }: RecordSpriteOptions,
): Promise<void> {
  const { astroDir, stateFile, assetsDir } = spritePaths(rootDir);
  await ensureDir(astroDir);

  if (!sprite) {
    const state = await readSpriteState(stateFile);
    state.collections[collection] = { sprite: false };
    await writeSpriteState(stateFile, state);
    return;
  }

  await ensureDir(assetsDir);
  const assetPath = new URL(`./${collection}.svg`, assetsDir);
  await writeFile(assetPath, assetContent ?? "");

  const state = await readSpriteState(stateFile);
  state.collections[collection] = {
    sprite: true,
    hash,
    assetPath: assetPath.href,
  };
  await writeSpriteState(stateFile, state);
}

/**
 * Derives the runtime sprite manifest from recorded state. Called by the
 * sprite integration's Vite plugin every time `virtual:astro-icon/sprite-manifest`
 * is loaded - which happens during bundling, after content sync has already
 * run, so it always sees the loaders' latest recorded state without needing
 * a separate "write a file, hope it's fresh" step.
 */
export async function readSpriteManifest(
  rootDir: URL,
): Promise<SpriteManifest> {
  const { stateFile } = spritePaths(rootDir);
  const state = await readSpriteState(stateFile);

  const manifest: SpriteManifest = {};
  for (const [collection, entry] of Object.entries(state.collections)) {
    if (!entry.sprite || !entry.hash) continue;
    manifest[collection] = { hash: entry.hash, assetIcons: "all" };
  }
  return manifest;
}

export interface SpriteAsset {
  collection: string;
  hash: string;
  content: string;
}

/** Reads every sprited collection's staged asset content, for the integration to serve (dev) or emit (build). */
export async function readSpriteAssets(rootDir: URL): Promise<SpriteAsset[]> {
  const { stateFile } = spritePaths(rootDir);
  const state = await readSpriteState(stateFile);

  const assets: SpriteAsset[] = [];
  for (const [collection, entry] of Object.entries(state.collections)) {
    if (!entry.sprite || !entry.hash || !entry.assetPath) continue;
    try {
      const content = await readFile(new URL(entry.assetPath), "utf-8");
      assets.push({ collection, hash: entry.hash, content });
    } catch {
      // Staged asset missing (e.g. .astro/ was cleaned between sync and this read) - skip it,
      // consistent with everything else here degrading rather than failing the build.
    }
  }
  return assets;
}
