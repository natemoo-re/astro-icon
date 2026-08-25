import { getLiveEntry } from "astro:content";
import { AstroIconError } from "../internal/error.js";
import { renderTimeError } from "./error.js";
import {
  DEFAULT_COLLECTION,
  parseIconName,
  type ParsedName,
} from "./parseIconName.js";
import { isCollectionEmpty, resolveIconEntry } from "./lookupEntry.js";
import type { IconEntry } from "../../typings/types";

export interface PreparedIcon {
  entry: IconEntry;
  /** The `data-icon` marker's value - see CONTEXT.md's "Icon marker". */
  marker: string;
}

/** The one format for the `data-icon="..."` marker, shared by `<Icon>` and `<LiveIcon>`: `"collection:name"` when the name came with an explicit collection, or just `name` when it resolved against the default collection implicitly. */
function formatIconMarker({ collection, name, hasPrefix }: ParsedName): string {
  return hasPrefix ? `${collection}:${name}` : name;
}

/**
 * Resolves an `<Icon name="...">` prop into a render-ready entry, or throws the exact hint
 * `<Icon>` has always thrown - parsing, lookup, and every "why didn't this resolve" branch, in
 * one place instead of spread across the `.astro` shell.
 */
export async function prepareIcon(name: string): Promise<PreparedIcon> {
  const parsed = parseIconName(name);
  const { collection, name: iconName, hasPrefix } = parsed;

  if (!iconName) {
    throw renderTimeError(
      `Invalid "name" provided!`,
      `The provided value of "${name}" is invalid.\n\nDid you mean to provide an icon name?`,
    );
  }

  const entry = await resolveIconEntry(collection, iconName);

  if (!entry) {
    const empty = await isCollectionEmpty(collection);
    throw renderTimeError(
      `Unable to locate "${name}" icon!`,
      hasPrefix
        ? empty
          ? `The "${collection}" collection loaded no icons at all, so it can't have "${iconName}" either.\n\nThis usually means its source failed to load - check the terminal (or your dev server logs) for a warning from "${collection}"'s loader.`
          : `The "${collection}" collection doesn't have an icon named "${iconName}".\n\nDid you define a collection named "${collection}" in "src/content.config.ts", and does it include this icon?`
        : empty
          ? `The "${DEFAULT_COLLECTION}" collection loaded no icons at all, so it can't have "${iconName}" either.\n\nThis usually means its source failed to load - check the terminal (or your dev server logs) for a warning from "${DEFAULT_COLLECTION}"'s loader.`
          : `No collection named "${DEFAULT_COLLECTION}" produced an icon named "${iconName}".\n\nBare names resolve to a collection literally named "${DEFAULT_COLLECTION}": define one in "src/content.config.ts", or use the "collection:name" form (e.g. "${iconName}" from a specific pack).`,
    );
  }

  return { entry: entry.data, marker: formatIconMarker(parsed) };
}

/**
 * Resolves a `<LiveIcon collection="..." icon="...">` prop pair into a render-ready entry, or
 * `undefined` when it should render nothing - `<LiveIcon>`'s "warn and skip" philosophy on a
 * miss, as opposed to `<Icon>`'s throw, owned here instead of in the `.astro` shell so it's
 * reachable from a unit test without a real Astro build.
 */
export async function prepareLiveIcon(
  collection: string,
  icon: string,
): Promise<PreparedIcon | undefined> {
  if (!collection || !icon) {
    throw renderTimeError(
      `Invalid "collection" or "icon" provided!`,
      `<LiveIcon> requires both a "collection" and an "icon" prop; got collection="${collection}", icon="${icon}".`,
    );
  }

  const { entry, error } = await getLiveEntry(collection, icon);

  if (error || !entry) {
    const hint = error instanceof AstroIconError ? error.hint : undefined;
    console.warn(
      `<LiveIcon> failed to load "${collection}:${icon}"${error ? `: ${error.message}` : ""}${hint ? `\nHint: ${hint}` : ""}`,
    );
    return undefined;
  }

  return {
    entry: entry.data as IconEntry,
    marker: formatIconMarker({ collection, name: icon, hasPrefix: true }),
  };
}
