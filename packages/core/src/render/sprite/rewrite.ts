import { parseIconName } from "../parseIconName.js";

export interface SpriteIconRef {
  collection: string;
  name: string;
  /** Shared with the `<symbol>` this ref should resolve to: `ai:${collection}:${name}`. */
  id: string;
}

export interface SpriteSymbolData {
  viewBox: string;
  body: string;
}

const SVG_OPEN_TAG = /<svg\b([^>]*)>/g;
const DATA_ICON_ATTR = /\bdata-icon="([^"]*)"/;
// Marks `<LiveIcon>` output, which is never resolved or deduped by Sprite.
const DATA_ICON_LIVE_ATTR = /\bdata-icon-live\b/;
// Tolerates leading whitespace (Astro's compiler inserts text nodes around `{titleId && <title>...}`)
// and an optional opening-tag attribute list, since `<title>`/`<desc>` carry a generated `id` (see props.ts).
const LEADING_TITLE = /^\s*<title(?:\s[^>]*)?>[\s\S]*?<\/title>/;
const LEADING_DESC = /^\s*<desc(?:\s[^>]*)?>[\s\S]*?<\/desc>/;

/** The id shared by an icon's `<symbol>` and its `<use>`/inline body. Only used within sprite rewriting. */
function iconId(collection: string, name: string): string {
  return `ai:${collection}:${name}`;
}

/** Reads an `<svg>` opening tag's attributes, returning its marker info, or `undefined` if absent or a `<LiveIcon>`. */
function markerFrom(openTagAttrs: string): SpriteIconRef | undefined {
  const dataIconMatch = DATA_ICON_ATTR.exec(openTagAttrs);
  if (!dataIconMatch) return undefined;
  if (DATA_ICON_LIVE_ATTR.test(openTagAttrs)) return undefined;
  const { collection, name } = parseIconName(dataIconMatch[1]);
  return { collection, name, id: iconId(collection, name) };
}

/** Finds every unique `<Icon>` rendered into `html` via its `data-icon` marker, in first-seen order. Skips `<LiveIcon>`s. */
export function extractSpriteIcons(html: string): SpriteIconRef[] {
  const seen = new Set<string>();
  const refs: SpriteIconRef[] = [];
  const re = new RegExp(SVG_OPEN_TAG.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const marker = markerFrom(match[1] ?? "");
    if (!marker || seen.has(marker.id)) continue;
    seen.add(marker.id);
    refs.push(marker);
  }
  return refs;
}

/** Finds the `</svg>` that closes the tag opened just before `searchFrom`, accounting for any `<svg>` nested inside the icon's own body. */
function findMatchingCloseTag(html: string, searchFrom: number): number {
  let depth = 1;
  let cursor = searchFrom;
  while (depth > 0) {
    const nextOpen = html.indexOf("<svg", cursor);
    const nextClose = html.indexOf("</svg>", cursor);
    if (nextClose === -1) return -1;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      cursor = nextOpen + "<svg".length;
    } else {
      depth--;
      cursor = nextClose + "</svg>".length;
    }
  }
  return cursor - "</svg>".length;
}

/** Extracts the leading `<title>`/`<desc>` (per-instance text) that must survive Sprite's `<use>` rewrite. */
function leadingTitleDesc(inner: string): string {
  let prefix = "";
  let rest = inner;
  const titleMatch = LEADING_TITLE.exec(rest);
  if (titleMatch) {
    prefix += titleMatch[0];
    rest = rest.slice(titleMatch[0].length);
  }
  const descMatch = LEADING_DESC.exec(rest);
  if (descMatch) {
    prefix += descMatch[0];
  }
  return prefix;
}

/** Rewrites each `<svg data-icon>` in `resolvedSymbols` into `<svg ...attrs><use href="#id" /></svg>`, preserving title/desc; others are left untouched. */
export function rewriteSpriteHtml(
  html: string,
  resolvedSymbols: Map<string, SpriteSymbolData>,
): string {
  let result = "";
  let cursor = 0;
  const re = new RegExp(SVG_OPEN_TAG.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const marker = markerFrom(match[1] ?? "");
    if (!marker || !resolvedSymbols.has(marker.id)) continue;

    const openTagEnd = re.lastIndex;
    const closeTagStart = findMatchingCloseTag(html, openTagEnd);
    if (closeTagStart === -1) continue;
    const closeTagEnd = closeTagStart + "</svg>".length;

    const inner = html.slice(openTagEnd, closeTagStart);

    result += html.slice(cursor, openTagEnd);
    result += leadingTitleDesc(inner);
    result += `<use href="#${marker.id}" />`;
    result += "</svg>";

    cursor = closeTagEnd;
    re.lastIndex = closeTagEnd;
  }
  result += html.slice(cursor);
  return result;
}
