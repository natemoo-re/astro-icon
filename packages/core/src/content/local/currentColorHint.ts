const COLOR_ATTR_RE = /\b(?:fill|stroke)="([^"]*)"/g;
const IGNORED_VALUES = new Set([
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
export function looksLikeItNeedsCurrentColor(
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
    if (normalized === "" || IGNORED_VALUES.has(normalized)) continue;
    colors.add(normalized);
  }
  for (const match of body.matchAll(COLOR_ATTR_RE)) {
    const value = match[1].trim().toLowerCase();
    if (value === "" || IGNORED_VALUES.has(value)) continue;
    colors.add(value);
  }

  return colors.size <= 1;
}
