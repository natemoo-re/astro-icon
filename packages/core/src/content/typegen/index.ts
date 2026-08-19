import { writeFile } from "node:fs/promises";
import { ensureDir, readState, typegenPaths, writeState } from "./state.js";
import { renderIndex, writePartial } from "./render.js";
import type { TypegenKind } from "./state.js";

type CollectionKind = Extract<TypegenKind, "build" | "live">;

// Serializes concurrent writes from multiple loaders running in the same sync.
let chain: Promise<void> = Promise.resolve();

function enqueueWrite(
  rootDir: URL,
  kind: TypegenKind,
  collection: string,
  names: string[],
): Promise<void> {
  chain = chain.then(() => writeTypes(rootDir, kind, collection, names));
  return chain;
}

type RecordCollectionFn = (
  rootDir: URL,
  kind: CollectionKind,
  collection: string,
  names: string[],
) => Promise<void>;

let recordCollectionImpl: RecordCollectionFn = enqueueWrite;

/** Records a collection's full icon name set to its own declaration file under `.astro/astro-icon/`, for autocomplete. */
export function recordCollection(
  rootDir: URL,
  kind: CollectionKind,
  collection: string,
  names: string[],
): Promise<void> {
  return recordCollectionImpl(rootDir, kind, collection, names);
}

/**
 * Swaps `recordCollection`'s implementation for a fake, so a loader test can assert on it without touching disk; for tests only.
 * @private
 */
export function __setRecordCollection(fn: RecordCollectionFn): void {
  recordCollectionImpl = fn;
}

/** Records an Iconify pack's full, unfiltered catalog, so `icons: [...]` options can be typed and autocompleted against it. Not a collection - kept as a separate entry point so `recordCollection`'s `kind` can never be "packs". */
export function recordCatalog(
  rootDir: URL,
  pack: string,
  names: string[],
): Promise<void> {
  return enqueueWrite(rootDir, "packs", pack, names);
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
