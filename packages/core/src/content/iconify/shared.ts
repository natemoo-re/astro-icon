import type { IconifyJSON } from "@iconify/types";
import type { AstroIntegrationLogger } from "astro";
import { AstroIconError } from "../../internal/error.js";
import { entryFromIconifyData } from "../ingest/entryFromIconifyData.js";
import type { IconEntry, TransformFn } from "../../../typings/types";

/**
 * The `allowed: [...]` option as a Set (deduped), or `undefined` when the option wasn't given -
 * warning once about any duplicate names on the way, since they're silently deduped everywhere
 * the Set is used.
 */
export function dedupeAllowed(
  pack: string,
  sourceLabel: string,
  allowedNames: readonly string[] | undefined,
  logger: Pick<AstroIntegrationLogger, "warn">,
): Set<string> | undefined {
  if (!allowedNames) return undefined;
  const allowed = new Set(allowedNames);
  if (allowed.size !== allowedNames.length) {
    const seen = new Set<string>();
    const duplicates = allowedNames.filter(
      (name) => seen.size === seen.add(name).size,
    );
    logger.warn(
      `"${pack}"'s \`allowed: [...]\` option repeats ${duplicates.length === 1 ? "a name" : "names"}: ${[...new Set(duplicates)].map((name) => `"${name}"`).join(", ")} (${sourceLabel}). Duplicates are silently deduped; remove the repeat(s) to avoid confusion.`,
    );
  }
  return allowed;
}

/**
 * Splits one `getIcons(names)` batch into allowlist rejections (stamped into `result` as
 * per-name errors via `rejection`) and the names left to actually fetch. With no allowlist,
 * everything is fetchable.
 */
export function partitionAllowed(
  names: string[],
  allowed: Set<string> | undefined,
  rejection: (name: string) => Error,
): { result: Map<string, IconEntry | Error>; toFetch: string[] } {
  const result = new Map<string, IconEntry | Error>();
  const toFetch: string[] = [];
  for (const name of names) {
    if (allowed && !allowed.has(name)) result.set(name, rejection(name));
    else toFetch.push(name);
  }
  return { result, toFetch };
}

/**
 * Resolves each of `names` out of a loaded pack into `result`: a built (and `transform`ed)
 * `IconEntry`, or a "pack doesn't include this icon" error for a name `data` lacks.
 */
export async function addPackEntries(
  result: Map<string, IconEntry | Error>,
  data: IconifyJSON,
  names: string[],
  pack: string,
  transform: TransformFn | undefined,
): Promise<void> {
  for (const name of names) {
    const entry = entryFromIconifyData(data, name);
    if (!entry) {
      result.set(
        name,
        new AstroIconError(
          `"${pack}" does not include an icon named "${name}".`,
          `Check the icon's name at https://icon-sets.iconify.design/${pack}/, or that you didn't mean a different pack.`,
        ),
      );
      continue;
    }
    result.set(
      name,
      transform ? await transform(entry, { collection: pack, name }) : entry,
    );
  }
}

/** The per-name error for a `getIcons` request outside the source's `allowed: [...]` list; `hint` finishes the "remove the option to allow ..." sentence (local and API sources can allow different things). */
export function allowlistRejection(
  pack: string,
  allowedCount: number,
  hint: string,
): (name: string) => Error {
  return (name) =>
    new AstroIconError(
      `"${name}" isn't in the allowed icon list for "${pack}" (${allowedCount} icon(s) allowed).`,
      `Add "${name}" to the \`allowed: [...]\` option for this source, or remove the option to allow ${hint}.`,
    );
}
