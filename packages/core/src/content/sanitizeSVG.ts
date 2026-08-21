import { ELEMENT_NODE, parse, renderSync, walkSync } from "ultrahtml";
import type { ElementNode, Node } from "ultrahtml";

// Real, executable content only - never a legitimate part of an icon's markup, so removing it
// can't be "wrong" for a genuine icon the way a cosmetic rewrite (color, id-prefixing) could be.
// Compared case-insensitively: browsers case-fold element/attribute names when parsing HTML,
// including inside an SVG integration point (e.g. `<FOREIGNOBJECT>` still becomes the real
// `foreignObject` element), so a denylist that only matched exact case would be trivially bypassed.
const DANGEROUS_TAGS = new Set(["script", "foreignobject"]);
const URI_ATTRS = new Set(["href", "xlink:href", "src"]);
const DANGEROUS_URI_RE = /^(javascript|vbscript):|^data:text\/html/i;
const WHITESPACE_AND_CONTROL_CHARS_RE = /[\x00-\x20]+/g;

// A sound (not heuristic) pre-check: everything the walk below can ever remove hinges on one of
// these substrings being literally present in the source - a dangerous tag name, an `on*`
// attribute name, or one of `URI_ATTRS` (`xlink:href` matches via the `href` alternative). If
// none appear, the full parse+walk is guaranteed to find nothing to remove, so it's skipped.
// Deliberately over-matches (e.g. "href" inside unrelated text) rather than under-matches, since
// a false positive only costs a redundant parse, while a false negative would be a real bypass.
const MAYBE_ACTIVE_CONTENT_RE =
  /<\s*(?:script|foreignobject)\b|on[a-z]+\s*=|href\s*=|src\s*=/i;

function isDangerousUri(value: string): boolean {
  // Strip control characters and whitespace, a common obfuscation for `java\tscript:`-style bypasses.
  const normalized = value.replace(WHITESPACE_AND_CONTROL_CHARS_RE, "");
  return DANGEROUS_URI_RE.test(normalized);
}

/**
 * Strips active content from an icon's inner SVG markup: `<script>`,
 * `<foreignObject>` (arbitrary embedded HTML), `on*` event handler
 * attributes, and `javascript:`/`vbscript:`/`data:text/html` URIs in
 * `href`/`xlink:href`/`src`. Everything else - `<style>`, `<text>`,
 * comments, gradients, masks - passes through untouched.
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
  const toRemove: Node[] = [];
  let changed = false;

  walkSync(root, (node) => {
    if (node.type !== ELEMENT_NODE) return;
    const element = node as ElementNode;

    if (DANGEROUS_TAGS.has(element.name.toLowerCase())) {
      toRemove.push(element);
      changed = true;
      return;
    }

    for (const attrName of Object.keys(element.attributes)) {
      const lower = attrName.toLowerCase();
      if (lower.startsWith("on")) {
        delete element.attributes[attrName];
        changed = true;
      } else if (
        URI_ATTRS.has(lower) &&
        isDangerousUri(element.attributes[attrName])
      ) {
        delete element.attributes[attrName];
        changed = true;
      }
    }
  });

  // Nothing dangerous found: return the original markup as-is rather than re-serializing
  // through ultrahtml's renderer, which normalizes formatting (e.g. `<path/>` -> `<path />`)
  // that a mandatory security pass has no business changing.
  if (!changed) return body;

  // Removed after the walk completes, not during: WalkerSync iterates `children` by index, so
  // splicing mid-walk would skip whatever shifted into the removed slot.
  for (const node of toRemove) {
    const parent = node.parent as (Node & { children: Node[] }) | undefined;
    if (!parent) continue;
    parent.children = parent.children.filter((child) => child !== node);
  }

  return renderSync(root)
    .replace(/^<svg>/, "")
    .replace(/<\/svg>$/, "");
}

/**
 * Strips the same active content `sanitizeSVGBody` strips from the body - `on*` event handler
 * attributes and `javascript:`/`vbscript:`/`data:text/html` URIs in `href`/`xlink:href`/`src` -
 * from an `IconEntry`'s root `<svg>` attributes (e.g. `fill`/`stroke`/`class`/`style`, see
 * `extractRootAttrs`). A non-string value (`width`/`height`, both numbers) passes through
 * untouched, as do the structural/accessibility attributes `extractRootAttrs` already excludes
 * (`viewBox`, `xmlns`, `role`, `aria-*`, ...) - they never reach here in the first place.
 *
 * Applied unconditionally regardless of source, same as `sanitizeSVGBody`: a root attribute can
 * come from a local `.svg` file authored by someone else, or from a site owner's own `optimize`
 * function acting on fetched (partially untrusted) data.
 */
export function sanitizeRootAttrs<T extends Record<string, unknown>>(
  attrs: T,
): T {
  let sanitized: Record<string, unknown> | undefined;

  for (const [attrName, value] of Object.entries(attrs)) {
    if (typeof value !== "string") continue;
    const lower = attrName.toLowerCase();
    const dangerous =
      lower.startsWith("on") || (URI_ATTRS.has(lower) && isDangerousUri(value));
    if (!dangerous) continue;
    // Cloned lazily, on the first attribute that actually needs dropping, so the common case (no
    // dangerous root attributes) returns the original object untouched.
    sanitized ??= { ...attrs };
    delete sanitized[attrName];
  }

  return (sanitized as T) ?? attrs;
}
