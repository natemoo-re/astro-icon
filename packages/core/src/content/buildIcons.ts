import { mapWithConcurrency } from "./concurrency.js";
import { sanitizeRootAttrs, sanitizeSVGBody } from "./sanitizeSVG.js";
import type { IconSource } from "./source.js";
import type { IconEntry } from "../../typings/types";

export interface BuiltIcon {
  name: string;
  data: IconEntry;
}

/**
 * Builds one icon via `source.getIcon()`. Every `IconSource`, custom ones included, funnels
 * through here before being stored - the one choke point that can't be bypassed by a source that
 * builds its own `IconEntry` without going through `parseIconSVG`.
 */
export async function buildIcon(
  source: Pick<IconSource, "getIcon">,
  name: string,
): Promise<BuiltIcon> {
  const data = await source.getIcon(name);
  return {
    name,
    data: { ...sanitizeRootAttrs(data), body: sanitizeSVGBody(data.body) },
  };
}

/**
 * Builds every name via `source.getIcon()`, skipping (and reporting via `onError`) any that
 * fail. Respects `source.concurrency` if set (see `IconSource.concurrency`); otherwise every
 * name is resolved at once, as before.
 */
export async function buildIcons(
  source: Pick<IconSource, "getIcon" | "concurrency">,
  names: string[],
  onError: (name: string, cause: unknown) => void,
): Promise<BuiltIcon[]> {
  const built = await mapWithConcurrency(
    names,
    source.concurrency,
    async (name): Promise<BuiltIcon | undefined> => {
      try {
        return await buildIcon(source, name);
      } catch (cause) {
        onError(name, cause);
        return undefined;
      }
    },
  );
  return built.filter((entry): entry is BuiltIcon => entry !== undefined);
}
