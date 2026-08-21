import { readFile, writeFile } from "node:fs/promises";
import { ensureDir } from "../typegen/state.js";

/** One collection's recorded sprite preference. `hash`/`assetPath` are only meaningful (and only ever set) when `sprite` is true. */
export interface SpriteCollectionState {
  sprite: boolean;
  hash?: string;
  /** Where the loader staged this collection's rendered sprite asset - the integration reads from here to serve/emit it. Not the public URL. */
  assetPath?: string;
}

/** Per-collection sprite state, recorded by the loader regardless of whether the sprite integration is installed. */
export interface SpriteState {
  collections: Record<string, SpriteCollectionState>;
}

export function spritePaths(rootDir: URL): {
  astroDir: URL;
  stateFile: URL;
  assetsDir: URL;
} {
  const astroDir = new URL("./.astro/", rootDir);
  const stateFile = new URL("./astro-icon-sprite.json", astroDir);
  const assetsDir = new URL("./astro-icon/sprite-assets/", astroDir);
  return { astroDir, stateFile, assetsDir };
}

export async function readSpriteState(stateFile: URL): Promise<SpriteState> {
  try {
    const text = await readFile(stateFile, { encoding: "utf-8" });
    const parsed = JSON.parse(text) as Partial<SpriteState>;
    return { collections: parsed.collections ?? {} };
  } catch {
    return { collections: {} };
  }
}

export async function writeSpriteState(
  stateFile: URL,
  state: SpriteState,
): Promise<void> {
  await writeFile(stateFile, JSON.stringify(state));
}

export { ensureDir };
