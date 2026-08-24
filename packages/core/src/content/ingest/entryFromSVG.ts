import { DOCUMENT_NODE, ELEMENT_NODE, TEXT_NODE, parse, renderSync, walkSync } from "ultrahtml";
import type { DocumentNode, ElementNode, Node } from "ultrahtml";
import { AstroIconError } from "../../internal/error.js";
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
   * `"derived"`: no usable `viewBox`, but unit-less numeric `width`/`height` root attributes were
   * found and turned into one. `"defaulted"`: neither was available, so `"0 0 24 24"` was used.
   */
  viewBox: "present" | "derived" | "defaulted";
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

// Handled elsewhere - `viewBox`/`width`/`height` are read separately and reapplied by the
// rendered `<svg>` wrapper itself, and the other two are only meaningful on a document root.
const STRUCTURAL_ROOT_ATTRS = new Set([
  "xmlns",
  "xmlns:xlink",
  "version",
  "viewbox",
  "width",
  "height",
]);
// Accessibility is `<Icon>`/`<LiveIcon>`'s contract, not the source file's: `iconA11yProps`
// computes `role`/`aria-hidden`/`aria-labelledby`/`aria-describedby`/`focusable` on the rendered
// `<svg>` itself based on the caller's `title`/`desc` props. A source file's own copies of these
// are almost always export-tool boilerplate, not a deliberate per-usage choice.
const A11Y_ROOT_ATTRS = new Set(["role", "focusable", "tabindex"]);

function isSkippedRootAttr(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    STRUCTURAL_ROOT_ATTRS.has(lower) ||
    A11Y_ROOT_ATTRS.has(lower) ||
    lower.startsWith("aria-")
  );
}

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

/** Pulls the first `<tagName>` anywhere in `root`'s subtree (excluding `root` itself) out, removing it from the tree. Trimmed text content, or `undefined` if absent/empty. */
function extractFirst(root: Node, tagName: string): string | undefined {
  let found: ElementNode | undefined;
  walkSync(root, (node) => {
    if (found || node === root) return;
    if (node.type === ELEMENT_NODE && node.name.toLowerCase() === tagName) {
      found = node;
    }
  });
  if (!found) return undefined;
  const text = textContent(found).trim();
  removeNode(found);
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

const COLOR_ATTR_RE = /\b(?:fill|stroke)="([^"]*)"/g;
const IGNORED_COLOR_VALUES = new Set([
  "none",
  "transparent",
  "currentcolor",
  "inherit",
]);

/**
 * A cheap, deliberately conservative signal for "this icon probably won't respond to
 * `color: ...` in CSS" - not a decision to act on, only to report via `EntryFacts` (see
 * `localSource()`, the one caller that turns it into a warning). Checks `body`'s own `fill`/
 * `stroke` attributes plus `rootAttrs` (the root `<svg>` tag's own, lifted separately). True when
 * `currentColor` is used nowhere, and every explicit `fill`/`stroke` found (if any) agrees on a
 * single color - the same shape a monochrome UI glyph has. An icon with two or more distinct
 * explicit colors reads as a deliberate multi-color graphic/logo, not a candidate for the
 * suggestion.
 */
function looksLikeItNeedsCurrentColor(
  body: string,
  rootAttrs: Record<string, string>,
): boolean {
  const rootColors = [rootAttrs.fill, rootAttrs.stroke].filter(
    (value): value is string => value != null,
  );
  if (rootColors.some((value) => value.toLowerCase() === "currentcolor")) {
    return false;
  }
  if (/currentcolor/i.test(body)) return false;

  const colors = new Set<string>();
  for (const value of rootColors) {
    const normalized = value.trim().toLowerCase();
    if (normalized === "" || IGNORED_COLOR_VALUES.has(normalized)) continue;
    colors.add(normalized);
  }
  for (const match of body.matchAll(COLOR_ATTR_RE)) {
    const value = match[1].trim().toLowerCase();
    if (value === "" || IGNORED_COLOR_VALUES.has(value)) continue;
    colors.add(value);
  }

  return colors.size <= 1;
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
 * 2. lift the root `<svg>`'s own non-structural, non-a11y attributes onto the entry, spread
 *    first so a stray one (e.g. a literal `body="..."` attribute) can never shadow a real field;
 * 3. lift the first `<title>`/`<desc>` anywhere in the body onto `title`/`desc`, removing them;
 * 4. resolve `viewBox`/`width`/`height` (present, derived from `width`/`height`, or defaulted to
 *    `24x24`), recorded as `facts.viewBox`;
 * 5. serialize what's left as `body`.
 *
 * Takes no policy parameters (no `optimize`, no `strict`, no logger): callers apply their own
 * policy to the returned `facts` (see `localSource()`), keeping this function itself a pure,
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
    if (isSkippedRootAttr(name)) continue;
    rootAttrs[name] = value;
  }

  const title = extractFirst(svgEl, "title");
  const desc = extractFirst(svgEl, "desc");

  const rawViewBox = getAttrCI(svgEl.attributes, "viewBox");
  const presentDimensions = rawViewBox
    ? parseViewBoxDimensions(rawViewBox)
    : undefined;

  let viewBox: string;
  let width: number;
  let height: number;
  let viewBoxFact: EntryFacts["viewBox"];
  if (presentDimensions) {
    viewBox = rawViewBox!;
    ({ width, height } = presentDimensions);
    viewBoxFact = "present";
  } else {
    const derived = deriveViewBoxFromSize(svgEl.attributes);
    if (derived) {
      ({ viewBox, width, height } = derived);
      viewBoxFact = "derived";
    } else {
      viewBox = "0 0 24 24";
      width = 24;
      height = 24;
      viewBoxFact = "defaulted";
    }
  }

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
      viewBox: viewBoxFact,
      monochromeWithoutCurrentColor: looksLikeItNeedsCurrentColor(
        body,
        rootAttrs,
      ),
    },
  };
}
