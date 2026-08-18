import { sanitizeSVGBody } from "./sanitizeSVG.js";
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
  onError: (name: string, cause: unknown) => void,
): Promise<BuiltIcon[]> {
  const results = await Promise.all(
    names.map(async (name) => {
      try {
        const data = await source.getIcon(name);
        // Every `IconSource`, custom ones included, funnels through here before being stored -
        // the one choke point that can't be bypassed by a source that builds its own `IconEntry`
        // without going through `parseIconSVG`.
        return { name, data: { ...data, body: sanitizeSVGBody(data.body) } };
      } catch (cause) {
        onError(name, cause);
        return undefined;
      }
    }),
  );
  return results.filter((entry): entry is BuiltIcon => entry !== undefined);
}
