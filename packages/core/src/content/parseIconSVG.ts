import type { AstroIntegrationLogger } from "astro";
import { AstroIconError } from "../internal/error.js";
import type { IconSource } from "./source.js";
import type { IconEntry, OptimizeFn } from "../../typings/types";

export interface ParseIconSVGOptions {
  /** The collection this icon belongs to. Passed through to `optimize` and used in warnings and errors. */
  collection: string;
  /** The icon's name within that collection. Passed through to `optimize` and used in warnings and errors. */
  name: string;
  optimize?: OptimizeFn;
  strict?: boolean;
  logger: Pick<AstroIntegrationLogger, "warn">;
  /** Fallback intrinsic size to use if optimization strips the viewBox and none can be recovered from the SVG's own attributes. Defaults to 24x24. */
  fallbackSize?: { width: number; height: number };
}

/**
 * Turns a raw SVG string into a render-ready {@link IconEntry}: runs
 * `optimize` first if given, then parses the result into
 * `{ body, viewBox, width, height }`, deriving a viewBox if optimization
 * stripped it.
 *
 * A generic entry point for any {@link IconSource} that produces a full
 * `<svg>...</svg>` string per icon. `iconifySource` is one such source; reach
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

  const parsed = parseSVG(svg);

  let { viewBox } = parsed;
  if (!viewBox) {
    const derived = deriveViewBox(svg, fallbackSize);
    if (strict) {
      throw new AstroIconError(
        `"${collection}:${name}" has no viewBox after optimization.`,
        `The SVG returned from "optimize" is missing a viewBox attribute. Either preserve it in your "optimize" function, or disable "strict" to fall back to a derived viewBox ("${derived}") instead of failing the build.`,
      );
    }
    logger.warn(
      `"${collection}:${name}" has no viewBox after optimization, falling back to a derived viewBox ("${derived}"). Preserve the viewBox in your "optimize" function to avoid this.`,
    );
    viewBox = derived;
  }

  // Derived from the viewBox, not the SVG's own attributes, which are often relative units like "1em".
  const [, , width, height] = viewBox.split(/\s+/).map(Number);

  return { body: parsed.body, viewBox, width, height };
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
