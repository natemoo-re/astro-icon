import type { AstroIntegrationLogger } from "astro";
import { AstroIconError } from "./AstroIconError.js";
import type { IconEntry, OptimizeFn } from "../../typings/types";

export interface ParseIconSVGOptions {
  /** The collection this icon belongs to - passed through to `optimize` and used in warnings/errors. */
  collection: string;
  /** The icon's name within that collection - passed through to `optimize` and used in warnings/errors. */
  name: string;
  optimize?: OptimizeFn;
  strict?: boolean;
  logger: Pick<AstroIntegrationLogger, "warn">;
  /**
   * Best-known intrinsic size to fall back to if optimization strips the
   * viewBox and none can be recovered from the SVG's own numeric width/height
   * attributes (e.g. iconify renders those as relative units like "1em" by
   * default, which aren't usable as pixel dimensions). Defaults to 24x24.
   */
  fallbackSize?: { width: number; height: number };
}

/**
 * Turns a single raw SVG string into a render-ready `IconEntry`: optionally
 * runs the user's `optimize`, then parses the result once into
 * `{ body, viewBox, width, height }`, deriving a viewBox (with a warning,
 * or an error under `strict`) if optimization stripped it.
 *
 * Generic entry point for any icon source that produces a full `<svg>...
 * </svg>` string per icon - iconify is one such source (see
 * `buildIconEntry` in `iconify/iconifySource.ts`), but this is also what a
 * custom `IconSource` should reach for.
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
      `"${collection}:${name}" has no viewBox after optimization - falling back to a derived viewBox ("${derived}"). Preserve the viewBox in your "optimize" function to avoid this.`,
    );
    viewBox = derived;
  }

  // Width/height are always derived from the viewBox, not from the SVG's own
  // width/height attributes - those are commonly relative units (e.g. "1em"),
  // which aren't meaningful as numbers.
  const [, , width, height] = viewBox.split(/\s+/).map(Number);

  return { body: parsed.body, viewBox, width, height };
}

function deriveViewBox(
  svg: string,
  fallbackSize?: { width: number; height: number },
): string {
  const attrs = svg.match(/<svg\b([^>]*)>/i)?.[1] ?? "";
  // Only trust width/height attributes that are plain numbers (no unit
  // suffix like "em"/"px") - otherwise fall back to the caller's best-known
  // intrinsic size, or 24x24.
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

/**
 * Minimal SVG parser: extracts the outer `<svg>` attributes we care about
 * and the inner markup. Intentionally not a full XML parser - icon SVGs are
 * a single, non-nested `<svg>...</svg>` document.
 */
function parseSVG(svg: string): ParsedSVG {
  const openTagMatch = svg.match(/<svg\b([^>]*)>/i);
  const attrs = openTagMatch?.[1] ?? "";
  const bodyMatch = svg.match(/<svg\b[^>]*>([\s\S]*)<\/svg>/i);
  const body = bodyMatch?.[1]?.trim() ?? "";

  const viewBox = attrs.match(/viewBox=["']([^"']+)["']/i)?.[1];

  return { body, viewBox };
}
