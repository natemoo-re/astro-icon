import type { IconSource } from "./iconSource.js";
import type { IconEntry } from "../../typings/types";

export interface ResolvedIcon {
  id: string;
  data: IconEntry;
}

/**
 * Resolves every name in `names` against `source.getIcon()`, in parallel. A
 * name that fails to resolve is skipped (reported via `onError`, which can
 * throw to abort the whole batch - e.g. for `strict` mode) rather than
 * failing every other icon too.
 *
 * Shared between `createIconLoader` (build) and `createLiveIconLoader`'s
 * `loadCollection` (live) - loading "everything a source has" is the same
 * logic in both; they just do different things with the result (write to
 * the persistent store vs. return `{ entries }` for one request).
 */
export async function resolveAllIcons(
  source: Pick<IconSource, "getIcon">,
  names: string[],
  onError: (name: string, error: unknown) => void,
): Promise<ResolvedIcon[]> {
  const results = await Promise.all(
    names.map(async (name) => {
      try {
        return { id: name, data: await source.getIcon(name) };
      } catch (ex) {
        onError(name, ex);
        return undefined;
      }
    }),
  );
  return results.filter((entry): entry is ResolvedIcon => entry !== undefined);
}
