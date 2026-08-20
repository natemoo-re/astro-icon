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
 * about (see `localSource()`). True when the icon already uses `currentColor`
 * nowhere, and every explicit `fill`/`stroke` it does have (if any) agrees on
 * a single color - the same shape a monochrome UI glyph has. An icon with two
 * or more distinct explicit colors reads as a deliberate multi-color
 * graphic/logo, not a candidate for the suggestion.
 */
export function looksLikeItNeedsCurrentColor(body: string): boolean {
  if (/currentcolor/i.test(body)) return false;

  const colors = new Set<string>();
  for (const match of body.matchAll(COLOR_ATTR_RE)) {
    const value = match[1].trim().toLowerCase();
    if (value === "" || IGNORED_VALUES.has(value)) continue;
    colors.add(value);
  }

  return colors.size <= 1;
}
