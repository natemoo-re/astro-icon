import type { AstroIntegrationLogger } from "astro";
import { parseIconSVG } from "../parseIconSVG.js";
import type { IconEntry, OptimizeFn } from "../../../typings/types";

/** The collection name a local icon reports in warnings, errors, and `optimize`'s context. */
const COLLECTION = "local";

// Handled elsewhere - `viewBox`/`width`/`height` are read off the parsed entry and reapplied by
// the rendered `<svg>` wrapper itself, and the other two are only meaningful on a document root.
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
// are almost always export-tool boilerplate (e.g. a generic `aria-hidden="true" role="img"` on
// every icon in a set), not a deliberate per-usage choice.
const A11Y_ROOT_ATTRS = new Set(["role", "focusable", "tabindex"]);
const ATTR_RE = /([a-zA-Z_:][-\w:.]*)\s*=\s*("[^"]*"|'[^']*')/g;

function isSkippedRootAttr(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    STRUCTURAL_ROOT_ATTRS.has(lower) ||
    A11Y_ROOT_ATTRS.has(lower) ||
    lower.startsWith("aria-")
  );
}

function unquote(value: string): string {
  return value.slice(1, -1);
}

/**
 * Reads whatever's left on a local icon's own root `<svg>` tag - `fill`, `stroke`, `color`,
 * `class`, `style`, or anything else an author put there - as plain data, not markup. Stored on
 * the `IconEntry` and spread onto the *rendered* `<svg>` by `renderableIconProps`, the same
 * default-that-a-caller's-own-prop-overrides treatment `width`/`height`/`viewBox` already get.
 *
 * Deliberately not reapplied by wrapping the body in a `<g>`: an inner element's own `fill`/
 * `stroke` always wins over whatever's set on an ancestor, so a `<g>` carrying the source's colors
 * would silently defeat a caller's `<Icon fill="red" />` override - it'd land on the outer `<svg>`,
 * but the inner `<g>`'s own `fill` still wins. Applying these to the *same* element the caller's
 * own props land on is what makes the override actually work, and avoids adding a DOM node (and
 * an extra id-collision surface) that isn't in the source file.
 */
function extractRootAttrs(svg: string): Record<string, string> {
  const openTag = svg.match(/<svg\b([^>]*)>/i)?.[1] ?? "";
  const attrs: Record<string, string> = {};
  for (const [, name, value] of openTag.matchAll(ATTR_RE)) {
    if (isSkippedRootAttr(name)) continue;
    attrs[name] = unquote(value);
  }
  return attrs;
}

const TITLE_RE = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i;
const DESC_RE = /<desc\b[^>]*>([\s\S]*?)<\/desc\s*>/i;

interface ExtractedTitleDesc {
  /** The icon's own `<title>` text, if it had one - a default for the `title` prop, not a mutation. */
  title?: string;
  /** The icon's own `<desc>` text, if it had one - a default for the `desc` prop, not a mutation. */
  desc?: string;
  /** `body` with that `<title>`/`<desc>` removed, so a caller-supplied `title`/`desc` prop doesn't end up rendered twice. */
  body: string;
}

/**
 * Pulls a local icon's own inline `<title>`/`<desc>` (if any) out of its body. `<Icon>`/`<LiveIcon>`
 * use the result as the icon's *default* `title`/`desc` prop value, honored only when the caller
 * doesn't pass their own - the same override relationship every other prop already has. Removing
 * them from `body` itself, rather than leaving them in place, avoids two problems a plain
 * extraction wouldn't: a caller who does pass their own `title` would otherwise get a second,
 * untouched `<title>` rendered alongside the one `<Icon>` builds (only the first is treated as the
 * accessible name/native tooltip, so the second is just dead weight); and a decorative icon (no
 * `title` passed, `aria-hidden="true"`) would still show the source's own `<title>` as a native
 * hover tooltip, since `aria-hidden` only affects the accessibility tree, not that behavior.
 */
function extractTitleDesc(body: string): ExtractedTitleDesc {
  let title: string | undefined;
  let desc: string | undefined;

  const withoutTitle = body.replace(TITLE_RE, (_match, inner: string) => {
    title = inner.trim() || undefined;
    return "";
  });
  const withoutDesc = withoutTitle.replace(DESC_RE, (_match, inner: string) => {
    desc = inner.trim() || undefined;
    return "";
  });

  return { title, desc, body: withoutDesc.trim() };
}

const COLOR_ATTR_RE = /\b(?:fill|stroke)="([^"]*)"/g;
const IGNORED_COLOR_VALUES = new Set([
  "none",
  "transparent",
  "currentcolor",
  "inherit",
]);

/**
 * A cheap, deliberately conservative signal for "this icon probably won't
 * respond to `color: ...` in CSS" - not a decision to act on, only to warn
 * about (see `localSource()`). Checks `body`'s own `fill`/`stroke` attributes
 * plus `rootAttrs` (the root `<svg>` tag's own `fill`/`stroke`, extracted
 * separately by `extractRootAttrs` - a `fill`/`stroke="currentColor"` set once
 * on the root is just as valid as one set on an inner element). True when
 * `currentColor` is used nowhere, and every explicit `fill`/`stroke` found (if
 * any) agrees on a single color - the same shape a monochrome UI glyph has.
 * An icon with two or more distinct explicit colors reads as a deliberate
 * multi-color graphic/logo, not a candidate for the suggestion.
 */
function looksLikeItNeedsCurrentColor(
  body: string,
  rootAttrs: Record<string, string> = {},
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

export interface ParseLocalIconSVGOptions {
  /** The icon's name within the local collection. Passed through to `optimize` and used in warnings and errors. */
  name: string;
  optimize?: OptimizeFn;
  /** Turns this icon's own parse warnings (a missing/invalid viewBox) into build errors. */
  strict?: boolean;
  logger: Pick<AstroIntegrationLogger, "warn">;
}

export interface ParsedLocalIcon {
  entry: IconEntry;
  /**
   * Whether this icon looks like it won't respond to CSS `color`. Reported rather than warned
   * about here, because the message names the directory the file came from - `localSource`'s own
   * state, and the only thing that makes the warning actionable.
   */
  needsCurrentColor: boolean;
}

/**
 * Turns one local `.svg` file's contents into an {@link IconEntry}, owning the whole
 * optimize -> parse -> extract -> merge order. That order is the actual contract, and each step
 * depends on the one before it in a way none of them state alone:
 *
 * - `optimize` runs *here* rather than being handed to `parseIconSVG`, because the optimized
 *   markup has to stay in scope for the root-attribute extraction below - `parseIconSVG` only
 *   returns the parsed body.
 * - `carryPresentationAttrs: false` is correct *only because* `extractRootAttrs` re-reads those
 *   same attributes as entry fields. Turning off one without the other either drops the source's
 *   colors entirely, or duplicates them onto an inner `<g>` that beats a caller's own override.
 * - `extractRootAttrs` reads the *optimized whole SVG* (it needs the root tag, which the parsed
 *   body excludes); `extractTitleDesc` reads the *parsed body* (the root tag has no `<title>`).
 * - the merge spreads `rootAttrs` first, so an author's stray root attribute can't shadow a real
 *   entry field: `IconEntry`'s index signature makes `<svg body="...">` type-check.
 * - the currentColor check needs both halves - the post-strip body *and* `rootAttrs` - so it can
 *   only run once the two extractions above have both happened.
 */
export async function parseLocalIconSVG(
  svg: string,
  { name, optimize, strict = false, logger }: ParseLocalIconSVGOptions,
): Promise<ParsedLocalIcon> {
  const optimizedSvg = optimize
    ? await optimize(svg, { collection: COLLECTION, name })
    : svg;

  const parsed = await parseIconSVG(optimizedSvg, {
    collection: COLLECTION,
    name,
    strict,
    logger,
    carryPresentationAttrs: false,
  });

  const rootAttrs = extractRootAttrs(optimizedSvg);
  const stripped = extractTitleDesc(parsed.body);

  const entry: IconEntry = {
    ...rootAttrs,
    ...parsed,
    body: stripped.body,
    ...(stripped.title ? { title: stripped.title } : {}),
    ...(stripped.desc ? { desc: stripped.desc } : {}),
  };

  return {
    entry,
    needsCurrentColor: looksLikeItNeedsCurrentColor(entry.body, rootAttrs),
  };
}
