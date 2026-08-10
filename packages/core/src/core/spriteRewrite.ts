import { iconId, parseIconName } from "./parseName.js";

export interface SpriteIconRef {
  collection: string;
  name: string;
  /** Shared with the `<symbol>` this ref should resolve to - `ai:${collection}:${name}`. */
  id: string;
}

export interface SpriteSymbolData {
  viewBox: string;
  body: string;
}

const SVG_OPEN_TAG = /<svg\b([^>]*)>/g;
const DATA_ICON_ATTR = /\bdata-icon="([^"]*)"/;
// `<LiveIcon>` marks its own output with this alongside `data-icon` - a live
// entry isn't guaranteed stable, so `Sprite` passes it through untouched
// instead of deduping it (even if its collection:name happens to collide
// with a resolved static icon's id - see `rewriteSpriteHtml`).
const DATA_ICON_LIVE_ATTR = /\bdata-icon-live\b/;
// `<Icon>` renders `{title && <title>...}{desc && <desc>...}` as separate
// template expressions, which Astro's compiler surrounds with literal
// whitespace text nodes in the output - so these tolerate (and preserve)
// leading/inter-tag whitespace rather than requiring an exact `<title>` at
// position 0.
const LEADING_TITLE = /^\s*<title>[\s\S]*?<\/title>/;
const LEADING_DESC = /^\s*<desc>[\s\S]*?<\/desc>/;

/**
 * Reads an `<svg>` opening tag's attributes and returns its marker info, or
 * `undefined` if it has no `data-icon` marker or carries `data-icon-live`
 * (a `<LiveIcon>` - never resolved or deduped, see `extractSpriteIcons` and
 * `rewriteSpriteHtml`).
 */
function markerFrom(openTagAttrs: string): SpriteIconRef | undefined {
  const dataIconMatch = DATA_ICON_ATTR.exec(openTagAttrs);
  if (!dataIconMatch) return undefined;
  if (DATA_ICON_LIVE_ATTR.test(openTagAttrs)) return undefined;
  const { collection, name } = parseIconName(dataIconMatch[1]);
  return { collection, name, id: iconId(collection, name) };
}

/**
 * Finds every unique icon `<Icon>` rendered into `html` (via its
 * `data-icon="collection:name"` marker), in first-seen order. Pure/sync -
 * no fetching, just string scanning, so it's usable independent of
 * `getEntry`.
 *
 * Skips `<LiveIcon>` occurrences (marked with `data-icon-live`) entirely -
 * they're never resolved or deduped, only passed through as-is by
 * `rewriteSpriteHtml`.
 */
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

/**
 * `<Icon>` always emits `<title>`/`<desc>` first, in that fixed order,
 * before the icon body. Sprite discards the shared body/viewBox in favor of
 * a `<use>`, but title/desc are per-instance text that must survive.
 */
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

/**
 * Rewrites every `<svg data-icon="...">...</svg>` occurrence whose id is in
 * `resolvedSymbols` into `<svg ...same attrs.../><use href="#id" /></svg>`,
 * preserving each occurrence's own opening tag (width/height/class/etc.)
 * and any leading title/desc. Occurrences whose id isn't in
 * `resolvedSymbols`, that have no `data-icon` marker at all (hand authored
 * SVG passed into the slot), or that carry `data-icon-live` (a `<LiveIcon>`
 * - never deduped, even if its collection:name happens to match a resolved
 * static icon's id) are left untouched.
 *
 * Single forward scan - icon bodies never contain a nested `<svg>` (an
 * existing invariant `<Icon>`'s own `set:html={body}` already relies on),
 * so the next literal `</svg>` after an opening tag is always its match.
 */
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
    const closeTagStart = html.indexOf("</svg>", openTagEnd);
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
