import {
  DOCUMENT_NODE,
  ELEMENT_NODE,
  TEXT_NODE,
  parse,
  renderSync,
  walkSync,
} from "ultrahtml";
import type { DocumentNode, ElementNode, Node } from "ultrahtml";
import { AstroIconError } from "../../internal/error.js";
import { rootAttrOwner } from "../../internal/entryContract.js";
import { sanitizeTree } from "../svgTree.js";
import type { IconEntry } from "../../../typings/types";

/**
 * What `entryFromSVG` learned about one icon while building its `IconEntry` - facts a caller
 * (a source) turns into policy (warn, throw, ignore) for itself, since `entryFromSVG` has no
 * collection/name/logger to act on any of this itself.
 */
export interface EntryFacts {
  /**
   * `"present"`: the root `<svg>` had a `viewBox` that parsed to four finite numbers, used as-is.
   * `"missing"`: it didn't, so one was recovered - from unit-less numeric `width`/`height` root
   * attributes when available, else the `"0 0 24 24"` default. The entry's own `viewBox` field
   * always holds whatever was resolved; callers that warn can simply quote it.
   */
  viewBox: "present" | "missing";
  /**
   * Whether this icon looks like it won't respond to CSS `color`: `currentColor` appears nowhere
   * (root or body), and every explicit `fill`/`stroke` found (if any) agrees on a single color -
   * the same shape a monochrome UI glyph has. A deliberately conservative signal to warn about,
   * not act on.
   */
  monochromeWithoutCurrentColor: boolean;
}

export interface EntryFromSVGResult {
  entry: IconEntry;
  facts: EntryFacts;
}

// `rootAttrOwner`'s ownership partition lives in `src/internal/entryContract.ts` now - shared
// with `renderableIconProps` on the render side, which needs the same reserved/attribute line.

function getAttrCI(
  attrs: Record<string, string>,
  name: string,
): string | undefined {
  const lower = name.toLowerCase();
  for (const key of Object.keys(attrs)) {
    if (key.toLowerCase() === lower) return attrs[key];
  }
  return undefined;
}

function findSvgElement(root: Node): ElementNode | undefined {
  let found: ElementNode | undefined;
  walkSync(root, (node) => {
    if (found) return;
    if (node.type === ELEMENT_NODE && node.name.toLowerCase() === "svg") {
      found = node;
    }
  });
  return found;
}

function textContent(node: Node): string {
  if (node.type === TEXT_NODE) return node.value;
  const children = (node as { children?: Node[] }).children;
  if (!children) return "";
  return children.map(textContent).join("");
}

function removeNode(node: Node): void {
  const parent = node.parent as (Node & { children: Node[] }) | undefined;
  if (!parent) return;
  parent.children = parent.children.filter((child) => child !== node);
}

/**
 * Pulls the first direct-child `<tagName>` of the root `<svg>` out of the tree, returning its
 * trimmed text (or `undefined` if absent/empty). Direct children only: per the SVG spec, only a
 * `<title>`/`<desc>` that's a direct child of an element names *that element* - one nested inside
 * a `<g>` labels the group, not the icon, and stays where it is.
 */
function extractFirstChild(
  svgEl: ElementNode,
  tagName: string,
): string | undefined {
  const found = svgEl.children.find(
    (node): node is ElementNode =>
      node.type === ELEMENT_NODE &&
      (node as ElementNode).name.toLowerCase() === tagName,
  );
  if (!found) return undefined;
  removeNode(found);
  const text = textContent(found).trim();
  return text || undefined;
}

const UNITLESS_NUMBER_RE = /^\d+(?:\.\d+)?$/;

/** `viewBox`'s width/height, or `undefined` if it isn't exactly four finite numbers (e.g. wrong token count, a non-numeric value). */
function parseViewBoxDimensions(
  viewBox: string,
): { width: number; height: number } | undefined {
  const [, , width, height] = viewBox.split(/\s+/).map(Number);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return undefined;
  return { width, height };
}

/** Derives a `0 0 w h` viewBox from unit-less numeric `width`/`height` root attributes, if both are present. */
function deriveViewBoxFromSize(
  attrs: Record<string, string>,
): { viewBox: string; width: number; height: number } | undefined {
  const rawWidth = getAttrCI(attrs, "width");
  const rawHeight = getAttrCI(attrs, "height");
  if (
    !rawWidth ||
    !rawHeight ||
    !UNITLESS_NUMBER_RE.test(rawWidth) ||
    !UNITLESS_NUMBER_RE.test(rawHeight)
  ) {
    return undefined;
  }
  const width = Number(rawWidth);
  const height = Number(rawHeight);
  return { viewBox: `0 0 ${width} ${height}`, width, height };
}

const IGNORED_COLOR_VALUES = new Set([
  "none",
  "transparent",
  "currentcolor",
  "inherit",
]);
const CURRENT_COLOR_RE = /currentcolor/i;

/**
 * A cheap, deliberately conservative signal for "this icon probably won't respond to
 * `color: ...` in CSS" - not a decision to act on, only to report via `EntryFacts` (see
 * `localIcons()`, the one caller that turns it into a warning). Walks the tree (root `<svg>`
 * included) rather than the serialized body: true when `currentColor` appears nowhere (any
 * attribute value, or text such as an inline `<style>` block), and every explicit `fill`/`stroke`
 * found (if any) agrees on a single color - the same shape a monochrome UI glyph has. An icon
 * with two or more distinct explicit colors reads as a deliberate multi-color graphic/logo, not
 * a candidate for the suggestion.
 */
function looksLikeItNeedsCurrentColor(svgEl: ElementNode): boolean {
  let usesCurrentColor = false;
  const colors = new Set<string>();

  walkSync(svgEl, (node) => {
    if (usesCurrentColor) return;
    if (node.type === TEXT_NODE) {
      if (CURRENT_COLOR_RE.test(node.value)) usesCurrentColor = true;
      return;
    }
    if (node.type !== ELEMENT_NODE) return;
    for (const [attrName, value] of Object.entries(
      (node as ElementNode).attributes,
    )) {
      if (CURRENT_COLOR_RE.test(value)) {
        usesCurrentColor = true;
        return;
      }
      const lower = attrName.toLowerCase();
      if (lower !== "fill" && lower !== "stroke") continue;
      const normalized = value.trim().toLowerCase();
      if (normalized === "" || IGNORED_COLOR_VALUES.has(normalized)) continue;
      colors.add(normalized);
    }
  });

  return !usesCurrentColor && colors.size <= 1;
}

/** Renders `children` (already stripped of anything that shouldn't survive into `body`) back to markup, minus the `<svg>` wrapper they came from. */
function serializeChildren(children: Node[]): string {
  const doc: DocumentNode = {
    type: DOCUMENT_NODE,
    children,
    attributes: {},
    parent: undefined,
  };
  return renderSync(doc);
}

/**
 * Turns raw SVG text into a render-ready `IconEntry` plus the `EntryFacts` observed while
 * building it - the canonical entry point for any `IconSource` that has a whole
 * `<svg>...</svg>` string per icon (local files, a custom source's own fetch). One real parse
 * with ultrahtml, then a handful of small, pure tree steps:
 *
 * 1. sanitize (`sanitizeTree` - the same rules `sanitizeSVGBody` applies, shared rather than
 *    duplicated);
 * 2. lift the entry-owned root `<svg>` attributes onto the entry (see `rootAttrOwner` for the
 *    ownership partition), spread first so a stray one (e.g. a literal `body="..."` attribute)
 *    can never shadow a real field;
 * 3. lift the root's own direct-child `<title>`/`<desc>` onto `title`/`desc`, removing them;
 * 4. resolve `viewBox`/`width`/`height` (used as-is when present, else recovered from
 *    `width`/`height` or a `24x24` default), recorded as `facts.viewBox`;
 * 5. serialize what's left as `body`.
 *
 * Takes no policy parameters (no `optimize`, no `strict`, no logger): callers apply their own
 * policy to the returned `facts` (see `localIcons()`), keeping this function itself a pure,
 * two-way mapping between SVG text and an `IconEntry`.
 */
export function entryFromSVG(svg: string): EntryFromSVGResult {
  const root = parse(svg);
  const svgEl = findSvgElement(root);
  if (!svgEl) {
    throw new AstroIconError(
      `This icon's SVG markup has no <svg> element.`,
      `Check the source data (or your "optimize" function, if set) returns the whole markup, not just its inner content.`,
    );
  }

  sanitizeTree(svgEl);

  const rootAttrs: Record<string, string> = {};
  for (const [name, value] of Object.entries(svgEl.attributes)) {
    if (rootAttrOwner(name) !== "entry") continue;
    rootAttrs[name] = value;
  }

  const title = extractFirstChild(svgEl, "title");
  const desc = extractFirstChild(svgEl, "desc");

  const rawViewBox = getAttrCI(svgEl.attributes, "viewBox");
  const presentDimensions = rawViewBox
    ? parseViewBoxDimensions(rawViewBox)
    : undefined;

  let viewBox: string;
  let width: number;
  let height: number;
  if (presentDimensions) {
    viewBox = rawViewBox!;
    ({ width, height } = presentDimensions);
  } else {
    ({ viewBox, width, height } = deriveViewBoxFromSize(svgEl.attributes) ?? {
      viewBox: "0 0 24 24",
      width: 24,
      height: 24,
    });
  }

  const monochromeWithoutCurrentColor = looksLikeItNeedsCurrentColor(svgEl);
  const body = serializeChildren(svgEl.children);

  const entry: IconEntry = {
    ...rootAttrs,
    body,
    viewBox,
    width,
    height,
    ...(title ? { title } : {}),
    ...(desc ? { desc } : {}),
  };

  return {
    entry,
    facts: {
      viewBox: presentDimensions ? "present" : "missing",
      monochromeWithoutCurrentColor,
    },
  };
}
