import type { AstroIntegrationLogger } from "astro";
import { AstroIconError } from "../internal/error.js";
import type { IconEntry, OptimizeFn } from "../../typings/types";

export interface ParseIconSVGOptions {
  /** The collection this icon belongs to. Passed through to `optimize` and used in warnings and errors. */
  collection: string;
  /** The icon's name within that collection. Passed through to `optimize` and used in warnings and errors. */
  name: string;
  optimize?: OptimizeFn;
  strict?: boolean;
  logger: Pick<AstroIntegrationLogger, "warn">;
  /** Fallback intrinsic size to use if there's no usable viewBox and none can be recovered from the SVG's own attributes. Defaults to 24x24. */
  fallbackSize?: { width: number; height: number };
  /**
   * Whether to re-home the root `<svg>`'s presentation attributes onto a wrapping `<g>` in
   * `body`. Defaults to `true`. Set `false` when the caller already extracts those attributes
   * itself (e.g. `localSource`'s `extractRootAttrs`, applied as entry fields rather than baked
   * into `body`) - carrying them here too would duplicate them, and a hardcoded value on the
   * inner `<g>` would silently win over a caller's `<Icon fill="..." />` landing on the outer
   * `<svg>` instead.
   */
  carryPresentationAttrs?: boolean;
}

/**
 * Turns a raw SVG string into a render-ready {@link IconEntry}: runs
 * `optimize` first if given, then parses the result into
 * `{ body, viewBox, width, height }`, deriving a viewBox if optimization
 * stripped it.
 *
 * A generic entry point for any {@link IconSource} that produces a full
 * `<svg>...</svg>` string per icon. `iconifyLocalSource`/`iconifyApiSource` are one such source; reach
 * for this directly when you write your own.
 */
export async function parseIconSVG(
  svg: string,
  {
    collection,
    name,
    optimize,
    strict = false,
    logger,
    fallbackSize,
    carryPresentationAttrs = true,
  }: ParseIconSVGOptions,
): Promise<IconEntry> {
  if (optimize) {
    svg = await optimize(svg, { collection, name });
  }

  if (!hasSvgElement(svg)) {
    throw new AstroIconError(
      `"${collection}:${name}" has no <svg> element.`,
      `This icon's SVG markup doesn't contain an <svg>...</svg> element. Check the source data (or your "optimize" function, if set) returns the whole markup, not just its inner content.`,
    );
  }

  const parsed = parseSVG(svg, carryPresentationAttrs);

  let { viewBox } = parsed;
  // Derived from the viewBox, not the SVG's own attributes, which are often relative units like
  // "1em" - `undefined` here means "not four finite numbers", covering both a missing viewBox
  // and one present but malformed (wrong token count, non-numeric values, ...).
  let dimensions = viewBox ? parseViewBoxDimensions(viewBox) : undefined;
  if (!dimensions) {
    const derived = deriveViewBox(svg, fallbackSize);
    const problem = viewBox
      ? `an invalid viewBox ("${viewBox}")`
      : "no viewBox";
    if (strict) {
      throw new AstroIconError(
        `"${collection}:${name}" has ${problem}.`,
        `This icon's SVG markup ${viewBox ? "has a viewBox that doesn't resolve to four numbers" : "is missing a viewBox attribute"}. Check the source data (or your "optimize" function, if set), or disable "strict" to fall back to a derived viewBox ("${derived}") instead of failing the build.`,
      );
    }
    logger.warn(
      `"${collection}:${name}" has ${problem}, falling back to a derived viewBox ("${derived}"). Check the source data (or your "optimize" function, if set) to avoid this.`,
    );
    viewBox = derived;
    // `deriveViewBox` always builds its result from numeric width/height (a regex-matched
    // unit-less attribute, or a fallback default), so this is always well-formed.
    dimensions = parseViewBoxDimensions(derived)!;
  }

  // Non-null: either present from the start (dimensions truthy skips the block above) or set to
  // `derived` (always a string) inside it.
  return { body: parsed.body, viewBox: viewBox!, ...dimensions };
}

/** `viewBox`'s width/height, or `undefined` if it isn't exactly four finite numbers (e.g. wrong token count, a non-numeric value). */
function parseViewBoxDimensions(
  viewBox: string,
): { width: number; height: number } | undefined {
  const [, , width, height] = viewBox.split(/\s+/).map(Number);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return undefined;
  return { width, height };
}

function deriveViewBox(
  svg: string,
  fallbackSize?: { width: number; height: number },
): string {
  const attrs = svg.match(/<svg\b([^>]*)>/i)?.[1] ?? "";
  // Only trust width/height attributes with no unit suffix (e.g. "em"/"px").
  const width =
    attrs.match(/\bwidth=["'](\d+(?:\.\d+)?)["']/i)?.[1] ??
    String(fallbackSize?.width ?? 24);
  const height =
    attrs.match(/\bheight=["'](\d+(?:\.\d+)?)["']/i)?.[1] ??
    String(fallbackSize?.height ?? 24);
  return `0 0 ${width} ${height}`;
}

/** Whether `svg` contains a well-formed `<svg>...</svg>` element at all - not just an empty/self-closing one, which `parseSVG` already handles fine via its own empty-`body` fallback. */
function hasSvgElement(svg: string): boolean {
  return /<svg\b[^>]*>[\s\S]*<\/svg>/i.test(svg) || /<svg\b[^>]*\/>/i.test(svg);
}

interface ParsedSVG {
  body: string;
  viewBox?: string;
}

const ATTR_RE = /([a-zA-Z_:][-\w:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

// Presentation attributes are inherited by the root `<svg>`'s children, so dropping
// them silently changes how an icon paints. Heroicons, Feather, and Lucide glyphs all
// declare `fill="none" stroke="currentColor"` there and nowhere else; without them the
// body falls back to SVG's defaults (`fill: black; stroke: none`) and renders as a solid
// shape that can no longer respond to CSS `color`.
//
// Deliberately an allowlist rather than "everything except viewBox": `class` would leak
// an author's sizing utilities (`h-6 w-6` on a Heroicons glyph) onto the body, and
// `width`/`height`/`xmlns`/`id` describe the element being replaced, not how it paints.
const CARRIED_PRESENTATION_ATTRS = new Set([
  "color",
  "fill",
  "fill-opacity",
  "fill-rule",
  "clip-rule",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-opacity",
  "paint-order",
  "opacity",
  "shape-rendering",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "letter-spacing",
  "text-anchor",
  "dominant-baseline",
]);

/**
 * Re-homes the root `<svg>`'s presentation attributes onto a wrapping `<g>` so they
 * survive into `body`, which is all any consumer of an {@link IconEntry} ever sees.
 *
 * A wrapper rather than hoisting onto each child: inheritance means a child's own
 * `fill`/`stroke` still wins over the group's, exactly as it did under the original root.
 */
function carryRootPresentation(body: string, attrs: string): string {
  if (!body) return body;

  const carried: string[] = [];
  for (const match of attrs.matchAll(ATTR_RE)) {
    const name = match[1];
    if (!CARRIED_PRESENTATION_ATTRS.has(name.toLowerCase())) continue;
    const value = (match[2] ?? match[3] ?? "").replaceAll('"', "&quot;");
    carried.push(`${name}="${value}"`);
  }

  // Nothing to carry (an Iconify body, or an icon that paints entirely through its own
  // children) - left byte-identical rather than wrapped in a `<g>` that would do nothing.
  if (carried.length === 0) return body;

  // `<title>`/`<desc>` describe the icon rather than painting it, and only label the
  // rendered `<svg>` while they're its direct children - wrapping them in the `<g>` would
  // demote them to labelling the group instead. Hoisted here so they stay top-level.
  const { hoisted, rest } = splitLeadingTitleDesc(body);
  return `${hoisted}<g ${carried.join(" ")}>${rest}</g>`;
}

const LEADING_TITLE_DESC_RE = /^\s*<(title|desc)\b[^>]*>[\s\S]*?<\/\1>/i;

/** Peels `<title>`/`<desc>` off the front of a body, the position the SVG spec wants them in for accessibility. */
function splitLeadingTitleDesc(body: string): {
  hoisted: string;
  rest: string;
} {
  let hoisted = "";
  let rest = body;

  let match = rest.match(LEADING_TITLE_DESC_RE);
  while (match) {
    hoisted += match[0].trim();
    rest = rest.slice(match[0].length);
    match = rest.match(LEADING_TITLE_DESC_RE);
  }

  return { hoisted, rest: rest.trim() };
}

/** Minimal SVG parser: extracts the outer `<svg>` attributes and inner markup. Not a full XML parser. */
function parseSVG(svg: string, carryPresentationAttrs: boolean): ParsedSVG {
  const openTagMatch = svg.match(/<svg\b([^>]*)>/i);
  const attrs = openTagMatch?.[1] ?? "";
  const bodyMatch = svg.match(/<svg\b[^>]*>([\s\S]*)<\/svg>/i);
  const body = bodyMatch?.[1]?.trim() ?? "";

  const viewBox = attrs.match(/viewBox=["']([^"']+)["']/i)?.[1];

  return {
    body: carryPresentationAttrs ? carryRootPresentation(body, attrs) : body,
    viewBox,
  };
}
