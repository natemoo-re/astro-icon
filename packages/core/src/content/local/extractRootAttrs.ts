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

function isSkipped(name: string): boolean {
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
export function extractRootAttrs(svg: string): Record<string, string> {
  const openTag = svg.match(/<svg\b([^>]*)>/i)?.[1] ?? "";
  const attrs: Record<string, string> = {};
  for (const [, name, value] of openTag.matchAll(ATTR_RE)) {
    if (isSkipped(name)) continue;
    attrs[name] = unquote(value);
  }
  return attrs;
}
