import type { IconSource } from "./iconSource.js";
import type { IconEntry } from "../../typings/types";

export interface ResolvedIcon {
  id: string;
  data: IconEntry;
}

/** Resolves every name against `source.getIcon()` in parallel, skipping (and reporting via `onError`) any that fail. */
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
