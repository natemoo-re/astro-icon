import { sanitizeSVGBody } from "./sanitizeSVG.js";
import type { IconSource } from "./source.js";
import type { IconEntry } from "../../typings/types";

export interface BuiltIcon {
  name: string;
  data: IconEntry;
}

/**
 * Builds one or many icons via `source.getIcons()` - the one choke point that can't be bypassed
 * by a source that builds its own `IconEntry` without going through `parseIconSVG`. Skips (and
 * reports via `onError`) any name that comes back missing or as an `Error`, rather than failing
 * the whole batch for one bad name.
 *
 * A single `string` is just a batch of one: `source.getIcons([name])` either way, one call
 * regardless of how many names are asked for - the same call a source with a real batching
 * backend (`iconifyApiSource`) turns into a single request for the whole list.
 */
export async function buildIcons(
  source: IconSource,
  names: string | string[],
  onError: (name: string, cause: unknown) => void,
): Promise<BuiltIcon[]> {
  const list = Array.isArray(names) ? names : [names];
  if (list.length === 0) return [];

  let resolved: Map<string, IconEntry | Error>;
  try {
    resolved = await source.getIcons(list);
  } catch (cause) {
    // A source that rejects outright (rather than returning a per-name `Error`) fails every
    // name in this batch for the same reason - see `IconSource.getIcons`'s doc comment.
    for (const name of list) onError(name, cause);
    return [];
  }

  const built: BuiltIcon[] = [];
  for (const name of list) {
    const result = resolved.get(name);
    if (!result) {
      onError(name, new Error(`"${name}" didn't resolve.`));
      continue;
    }
    if (result instanceof Error) {
      onError(name, result);
      continue;
    }
    built.push({ name, data: { ...result, body: sanitizeSVGBody(result.body) } });
  }
  return built;
}

/**
 * Builds exactly one icon, throwing (rather than reporting via `onError`) if it doesn't
 * resolve - a thin convenience over `buildIcons` for the handful of call sites that want
 * "give me this one icon or fail," not "collect failures and keep going" (a single live
 * `getLiveEntry()` lookup, a dev-mode file-change re-resolve).
 */
export async function buildIcon(
  source: IconSource,
  name: string,
): Promise<BuiltIcon> {
  let cause: unknown;
  const [built] = await buildIcons(source, name, (_name, ex) => {
    cause = ex;
  });
  if (!built) throw cause;
  return built;
}
