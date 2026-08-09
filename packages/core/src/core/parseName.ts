export interface ParsedName {
  collection: string;
  name: string;
  hasPrefix: boolean;
}

/**
 * Splits an `<Icon>` name on its *first* colon only, so pack names like
 * `logos:aws-s3` (which themselves contain no further colons) resolve
 * correctly and icon names that legitimately contain a colon aren't
 * truncated. A name with no colon resolves against the conventionally
 * named "icons" collection.
 */
export function parseIconName(name: string): ParsedName {
  const colonIndex = name.indexOf(":");
  if (colonIndex === -1) {
    return { collection: "icons", name, hasPrefix: false };
  }
  return {
    collection: name.slice(0, colonIndex),
    name: name.slice(colonIndex + 1),
    hasPrefix: true,
  };
}

/**
 * Same split, but for `<LiveIcon>`, which always requires an explicit
 * `collection:name` value - there is no default collection.
 */
export function parseLiveIconName(name: string): ParsedName | undefined {
  const colonIndex = name.indexOf(":");
  if (colonIndex === -1) return undefined;
  return {
    collection: name.slice(0, colonIndex),
    name: name.slice(colonIndex + 1),
    hasPrefix: true,
  };
}
