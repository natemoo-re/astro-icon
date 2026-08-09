/**
 * The parsed, render-ready representation of a single icon, as stored in
 * the content layer data store.
 */
export interface IconEntry {
  /** The inner SVG markup (everything between the outer `<svg>` tags). */
  body: string;
  /** The icon's `viewBox` attribute, either taken from the source SVG or derived from its width/height. */
  viewBox: string;
  width: number;
  height: number;
  [key: string]: string | number;
}

/**
 * Receives the raw, unoptimized SVG markup for a single icon and returns
 * the (optionally optimized) SVG markup to use instead. Plain function,
 * no dependency is bundled or invoked automatically.
 */
export type OptimizeFn = (
  svg: string,
  ctx: { collection: string; name: string },
) => string | Promise<string>;

export interface IconifySourceOptions {
  /**
   * Restricts this source to a fixed set of icon names - a deliberate
   * allowlist (e.g. a design system's approved set), not a performance
   * knob. Both loading and generated types reflect exactly this list.
   *
   * Omit to allow the whole pack: every icon it has is both loadable and
   * typed, provided the pack is resolvable in full (i.e. installed
   * locally - the public Iconify API can only ever return specific icons
   * you ask for, never "everything").
   */
  icons?: string[];
  /**
   * Optional transform applied to each icon's raw SVG markup before it is parsed and stored.
   */
  optimize?: OptimizeFn;
  /**
   * When true, turns warnings (missing pack found only via API fallback, missing
   * requested icon, missing/derived viewBox) into build errors.
   * @default false
   */
  strict?: boolean;
}
