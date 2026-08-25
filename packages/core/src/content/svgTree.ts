import { ELEMENT_NODE, walkSync } from "ultrahtml";
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

function isDangerousUri(value: string): boolean {
  // Strip control characters and whitespace, a common obfuscation for `java\tscript:`-style bypasses.
  const normalized = value.replace(WHITESPACE_AND_CONTROL_CHARS_RE, "");
  return DANGEROUS_URI_RE.test(normalized);
}

function removeNode(node: Node): void {
  const parent = node.parent as (Node & { children: Node[] }) | undefined;
  if (!parent) return;
  parent.children = parent.children.filter((child) => child !== node);
}

/**
 * Strips active content from an already-parsed tree, in place: `<script>`,
 * `<foreignObject>` (arbitrary embedded HTML), `on*` event handler
 * attributes, and `javascript:`/`vbscript:`/`data:text/html` URIs in
 * `href`/`xlink:href`/`src`. Everything else - `<style>`, `<text>`,
 * comments, gradients, masks - passes through untouched.
 *
 * The one place these rules live; both `sanitizeSVGBody` (a raw-string
 * entry point kept for backward compatibility) and `entryFromSVG` (which
 * already has a parsed tree in hand) apply them here rather than each
 * re-implementing the denylist.
 *
 * @returns Whether anything was actually removed/stripped.
 */
export function sanitizeTree(root: Node): boolean {
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

  // Removed after the walk completes, not during: a walk iterates `children` by index, so
  // splicing mid-walk would skip whatever shifted into the removed slot.
  for (const node of toRemove) removeNode(node);

  return changed;
}
