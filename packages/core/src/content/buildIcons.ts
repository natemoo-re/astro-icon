import type { IconSource } from "./source.js";
import type { IconEntry } from "../../typings/types";

export interface BuiltIcon {
  name: string;
  data: IconEntry;
}

/** Builds every name via `source.getIcon()` in parallel, skipping (and reporting via `onError`) any that fail. */
export async function buildIcons(
  source: Pick<IconSource, "getIcon">,
  names: string[],
  onError: (name: string, error: unknown) => void,
): Promise<BuiltIcon[]> {
  const results = await Promise.all(
    names.map(async (name) => {
      try {
        return { name, data: await source.getIcon(name) };
      } catch (ex) {
        onError(name, ex);
        return undefined;
      }
    }),
  );
  return results.filter((entry): entry is BuiltIcon => entry !== undefined);
}
