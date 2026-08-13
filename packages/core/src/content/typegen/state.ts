import { mkdir, readFile, writeFile } from "node:fs/promises";

export type TypegenKind = "build" | "live" | "packs";

export interface TypegenState {
  build: Record<string, string[]>;
  live: Record<string, string[]>;
  packs: Record<string, string[]>;
}

export function typegenPaths(rootDir: URL): {
  astroDir: URL;
  partialsDir: URL;
  stateFile: URL;
  indexFile: URL;
} {
  const astroDir = new URL("./.astro/", rootDir);
  const partialsDir = new URL("./astro-icon/", astroDir);
  const stateFile = new URL("./astro-icon.json", astroDir);
  const indexFile = new URL("./astro-icon.d.ts", astroDir);
  return { astroDir, partialsDir, stateFile, indexFile };
}

export async function readState(stateFile: URL): Promise<TypegenState> {
  try {
    const text = await readFile(stateFile, { encoding: "utf-8" });
    const parsed = JSON.parse(text) as Partial<TypegenState>;
    return { build: parsed.build ?? {}, live: parsed.live ?? {}, packs: parsed.packs ?? {} };
  } catch {
    return { build: {}, live: {}, packs: {} };
  }
}

export async function writeState(stateFile: URL, state: TypegenState): Promise<void> {
  await writeFile(stateFile, JSON.stringify(state));
}

export async function ensureDir(path: URL): Promise<void> {
  try {
    await mkdir(path, { recursive: true });
  } catch {}
}
