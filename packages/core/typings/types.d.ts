/**
 * The shape every icon collection stores in Astro's content layer, and what
 * `entry.data` gives you from `getEntry()` or `getLiveEntry()`.
 *
 * You won't normally construct this yourself: a loader (`iconify`,
 * `localIcons`, or a custom {@link IconSource}) builds it for you from raw
 * SVG. Reach for it directly if you write a custom loader or `optimize`
 * function and need the target shape.
 */
export interface IconEntry {
  /** The inner SVG markup, everything between the outer `<svg>` tags. */
  body: string;
  /** The icon's `viewBox` attribute, taken from the source SVG or derived from its width and height. */
  viewBox: string;
  width: number;
  height: number;
  [key: string]: string | number;
}

/**
 * A hook to transform an icon's SVG before astro-icon parses and stores it.
 * Common uses: running it through SVGO, stripping hardcoded `fill`/`stroke`
 * colors so CSS can control them, or adding `aria-hidden`.
 *
 * Pass one via the `optimize` option on {@link iconify}, {@link iconifySource},
 * {@link localIcons}, or {@link localSource}.
 */
export type OptimizeFn = (
  svg: string,
  ctx: { collection: string; name: string },
) => string | Promise<string>;

/** Options shared by {@link iconify} and {@link iconifySource} for configuring an Iconify pack. */
export interface IconifySourceOptions {
  /**
   * Restricts this source to a fixed list of icon names. Both what's loaded
   * and what's typed for autocomplete reflect exactly this list. Use it to
   * pin a design system's approved icons, not as a performance shortcut.
   *
   * Omit it to allow the whole pack. That requires the pack to be installed
   * locally (`npm install @iconify-json/<pack>`): the public Iconify API can
   * only resolve icons you name explicitly, never "every icon in the pack."
   */
  icons?: string[];
  /** Transform applied to each icon's raw SVG markup before astro-icon parses and stores it. */
  optimize?: OptimizeFn;
  /**
   * Turns a recoverable warning (pack resolved only through the API
   * fallback, a requested icon that's missing, a viewBox that had to be
   * derived) into a build error instead.
   * @default false
   */
  strict?: boolean;
}
