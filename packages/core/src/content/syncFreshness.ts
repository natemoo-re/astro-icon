import type { LoaderContext } from "astro/loaders";

/**
 * Whether a full rebuild can be skipped for this sync: `versionKey` is defined, matches the value
 * recorded under `metaKey` from the last sync, and every name in `names` is already in the store.
 * Shared by every build-time loader's "skip re-resolving everything, nothing changed" fast path -
 * `content/loader.ts` (an `IconSource`'s own version signal) and `content/local/loader.ts` (a
 * directory mtime+size fingerprint) compute `versionKey` differently, but decide whether to act
 * on it identically.
 */
export function isUpToDate(
  versionKey: string | undefined,
  metaKey: string,
  meta: Pick<LoaderContext["meta"], "get">,
  names: string[],
  store: Pick<LoaderContext["store"], "has">,
): boolean {
  return (
    !!versionKey &&
    versionKey === meta.get(metaKey) &&
    names.every((name) => store.has(name))
  );
}

/**
 * Records this sync's `versionKey` under `metaKey` for the next {@link isUpToDate} check, or
 * clears it if undefined (no reliable freshness signal, so the next sync always rebuilds).
 */
export function recordVersionKey(
  meta: Pick<LoaderContext["meta"], "set" | "delete">,
  metaKey: string,
  versionKey: string | undefined,
): void {
  if (versionKey) meta.set(metaKey, versionKey);
  else meta.delete(metaKey);
}
