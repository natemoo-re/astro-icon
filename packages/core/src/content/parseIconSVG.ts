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

  const parsed = parseSVG(svg);

  let { viewBox } = parsed;
  // Derived from the viewBox, not the SVG's own attributes, which are often relative units like
  // "1em" - `undefined` here means "not four finite numbers", covering both a missing viewBox
  // and one present but malformed (wrong token count, non-numeric values, ...). Zod's
  // `iconEntrySchema` does reject a NaN width/height, but only once this entry reaches Astro's
  // own `parseData` - well past `buildIcons`' per-icon try/catch, so that rejection would
  // otherwise crash the whole sync uncaught instead of respecting `strict`.
  let dimensions = viewBox ? parseViewBoxDimensions(viewBox) : undefined;
  if (!dimensions) {
    const derived = deriveViewBox(svg, fallbackSize);
    const problem = viewBox ? `an invalid viewBox ("${viewBox}")` : "no viewBox";
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

/** Minimal SVG parser: extracts the outer `<svg>` attributes and inner markup. Not a full XML parser. */
function parseSVG(svg: string): ParsedSVG {
  const openTagMatch = svg.match(/<svg\b([^>]*)>/i);
  const attrs = openTagMatch?.[1] ?? "";
  const bodyMatch = svg.match(/<svg\b[^>]*>([\s\S]*)<\/svg>/i);
  const body = bodyMatch?.[1]?.trim() ?? "";

  const viewBox = attrs.match(/viewBox=["']([^"']+)["']/i)?.[1];

  return { body, viewBox };
}
