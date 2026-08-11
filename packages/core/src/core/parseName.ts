export interface ParsedName {
  collection: string;
  name: string;
  hasPrefix: boolean;
}

/** The id shared by an icon's `<symbol>` and its `<use>`/inline body, used by `spriteRewrite`. */
export function iconId(collection: string, name: string): string {
  return `ai:${collection}:${name}`;
}

/** Splits an `<Icon>` name on its first colon only; a bare name resolves against the "icons" collection. */
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
