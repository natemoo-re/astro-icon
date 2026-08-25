/**
 * The collection a bare `<Icon name="...">` (no `"collection:"` prefix) resolves against. Also
 * hardcoded, necessarily, in `typings/names.d.ts`'s `AstroIconBare` - an ambient `.d.ts` can't
 * import a runtime value, so that's a plain `"icons"` literal with a comment pointing back here.
 */
export const DEFAULT_COLLECTION = "icons";

export interface ParsedName {
  collection: string;
  name: string;
  hasPrefix: boolean;
}

/** Splits an `<Icon>` name on its first colon only; a bare name resolves against {@link DEFAULT_COLLECTION}. */
export function parseIconName(name: string): ParsedName {
  const colonIndex = name.indexOf(":");
  if (colonIndex === -1) {
    return { collection: DEFAULT_COLLECTION, name, hasPrefix: false };
  }
  return {
    collection: name.slice(0, colonIndex),
    name: name.slice(colonIndex + 1),
    hasPrefix: true,
  };
}
