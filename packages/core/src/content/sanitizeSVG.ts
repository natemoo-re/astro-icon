import { parse, renderSync } from "ultrahtml";
import { sanitizeTree } from "./svgTree.js";

// A sound (not heuristic) pre-check: everything `sanitizeTree` can ever remove hinges on one of
// these substrings being literally present in the source - a dangerous tag name, an `on*`
// attribute name, or a URI attribute (`xlink:href` matches via the `href` alternative). If none
// appear, the full parse+walk is guaranteed to find nothing to remove, so it's skipped.
// Deliberately over-matches (e.g. "href" inside unrelated text) rather than under-matches, since
// a false positive only costs a redundant parse, while a false negative would be a real bypass.
const MAYBE_ACTIVE_CONTENT_RE =
  /<\s*(?:script|foreignobject)\b|on[a-z]+\s*=|href\s*=|src\s*=/i;

/**
 * Strips active content from an icon's inner SVG markup: `<script>`,
 * `<foreignObject>` (arbitrary embedded HTML), `on*` event handler
 * attributes, and `javascript:`/`vbscript:`/`data:text/html` URIs in
 * `href`/`xlink:href`/`src`. Everything else - `<style>`, `<text>`,
 * comments, gradients, masks - passes through untouched. See `sanitizeTree`
 * for the rules themselves, shared with `entryFromSVG`'s own sanitize pass.
 *
 * Applied unconditionally to every icon regardless of source (local files,
 * Iconify packs, or a custom `IconSource`), since a custom source backing
 * `<LiveIcon>` may carry content this library never validated.
 */
export function sanitizeSVGBody(body: string): string {
  if (!body) return body;
  if (!MAYBE_ACTIVE_CONTENT_RE.test(body)) return body;

  // Parsed inside a wrapper element so a top-level dangerous tag has a parent to be removed from.
  const root = parse(`<svg>${body}</svg>`);
  const changed = sanitizeTree(root);

  // Nothing dangerous found: return the original markup as-is rather than re-serializing
  // through ultrahtml's renderer, which normalizes formatting (e.g. `<path/>` -> `<path />`)
  // that a mandatory security pass has no business changing.
  if (!changed) return body;

  return renderSync(root)
    .replace(/^<svg>/, "")
    .replace(/<\/svg>$/, "");
}
