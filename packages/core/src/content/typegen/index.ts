import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
  renderIndex,
  writePartial,
  type TypegenKind,
  type TypegenState,
} from "./render.js";
import { consoleLogger } from "../logger.js";

export type { TypegenKind, TypegenState } from "./render.js";

type CollectionKind = Extract<TypegenKind, "build" | "live">;

/** An owned instance of the typegen write path - its own serialized write queue and its own catalog-dedupe set, scoped to this instance rather than shared ambiently across the whole process. Mirrors `createPackLoader()`. */
export interface TypegenRecorder {
  /** Records a collection's full icon name set to its own declaration file under `.astro/astro-icon/`, for autocomplete. */
  recordCollection(
    rootDir: URL,
    kind: CollectionKind,
    collection: string,
    names: string[],
  ): Promise<void>;
  /** Records an Iconify pack's full, unfiltered catalog, so `allowed: [...]` options can be typed and autocompleted against it. Not a collection - kept as a separate entry point so `recordCollection`'s `kind` can never be "packs". */
  recordCatalog(rootDir: URL, pack: string, names: string[]): Promise<void>;
}

function typegenPaths(rootDir: URL) {
  const astroDir = new URL("./.astro/", rootDir);
  const partialsDir = new URL("./astro-icon/", astroDir);
  const stateFile = new URL("./astro-icon.json", astroDir);
  const indexFile = new URL("./astro-icon.d.ts", astroDir);
  return { astroDir, partialsDir, stateFile, indexFile };
}

async function readState(stateFile: URL): Promise<TypegenState> {
  try {
    const text = await readFile(stateFile, { encoding: "utf-8" });
    const parsed = JSON.parse(text) as Partial<TypegenState>;
    return {
      build: parsed.build ?? {},
      live: parsed.live ?? {},
      packs: parsed.packs ?? {},
    };
  } catch {
    return { build: {}, live: {}, packs: {} };
  }
}

async function writeState(stateFile: URL, state: TypegenState): Promise<void> {
  await writeFile(stateFile, JSON.stringify(state));
}

async function ensureDir(path: URL): Promise<void> {
  try {
    await mkdir(path, { recursive: true });
  } catch {}
}

async function writeTypes(
  rootDir: URL,
  kind: TypegenKind,
  collection: string,
  names: string[],
): Promise<void> {
  const { partialsDir, stateFile, indexFile } = typegenPaths(rootDir);
  await ensureDir(partialsDir);

  const state = await readState(stateFile);
  state[kind][collection] = names;
  await writeState(stateFile, state);

  await writePartial(partialsDir, kind, collection, names);
  await writeFile(indexFile, renderIndex(state));
}

/**
 * Builds an independent `TypegenRecorder`. `iconify`/`loader`/`liveLoader` share one instance of
 * this (the default export below), built once, so writes for the same project are serialized
 * through one queue and a pack's catalog is recorded at most once per root. Tests construct their
 * own instance instead of mocking this module wholesale, substituted through each call site's
 * seam (`IconLoaderSyncContext.typegen`, `LiveIconLoaderOptions.typegen`).
 */
export function createTypegenRecorder(): TypegenRecorder {
  // Serializes concurrent writes from multiple loaders running in the same sync.
  let chain: Promise<void> = Promise.resolve();
  // Root+pack pairs already recorded in this instance's lifetime, so a busy collection doesn't
  // re-run the write chain per icon.
  const recordedCatalogs = new Set<string>();
  let warnedOnce = false;

  function enqueueWrite(
    rootDir: URL,
    kind: TypegenKind,
    collection: string,
    names: string[],
  ): Promise<void> {
    const attempt = chain.then(() =>
      writeTypes(rootDir, kind, collection, names),
    );
    // Rebased off `attempt` but with its rejection swallowed here, so one failed write (e.g. a
    // read-only `.astro/`) doesn't leave every later write attributed to a different collection
    // permanently rejected too.
    chain = attempt.catch(() => {});
    return attempt.catch((ex) => {
      if (!warnedOnce) {
        warnedOnce = true;
        const detail = ex instanceof Error ? ex.message : String(ex);
        consoleLogger.warn(
          `Couldn't write generated types under ".astro/": ${detail}`,
        );
      }
    });
  }

  return {
    recordCollection(rootDir, kind, collection, names) {
      return enqueueWrite(rootDir, kind, collection, names);
    },
    recordCatalog(rootDir, pack, names) {
      const key = `${rootDir.href}::${pack}`;
      if (recordedCatalogs.has(key)) return Promise.resolve();
      recordedCatalogs.add(key);
      return enqueueWrite(rootDir, "packs", pack, names);
    },
  };
}

const defaultRecorder = createTypegenRecorder();

/** @see {@link TypegenRecorder.recordCollection} */
export const recordCollection: TypegenRecorder["recordCollection"] =
  defaultRecorder.recordCollection;

/** @see {@link TypegenRecorder.recordCatalog} */
export const recordCatalog: TypegenRecorder["recordCatalog"] =
  defaultRecorder.recordCatalog;
