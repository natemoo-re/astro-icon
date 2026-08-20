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
 * Pass one via the `optimize` option on {@link iconifyLocalSource},
 * {@link iconifyApiSource}, {@link localIcons}, or {@link localSource}.
 */
export type OptimizeFn = (
  svg: string,
  ctx: { collection: string; name: string },
) => string | Promise<string>;

/** Options shared by {@link iconifyLocalSource} and {@link iconifyApiSource} for configuring an Iconify pack. */
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

/** Options for {@link iconifyApiSource}: {@link IconifySourceOptions} plus settings only meaningful for a network-backed source. */
export interface IconifyApiSourceOptions extends IconifySourceOptions {
  /**
   * Caps how many requests this source starts per second against the public Iconify API,
   * independent of `concurrency` (which bounds how many calls are in flight at once, not how
   * often a new one begins - see `createRateLimiter` from `astro-icon/utils` for the distinction).
   * Useful when a build hits the API for many packs/allowlists and you want to stay a good
   * citizen of the shared public service.
   *
   * @default undefined - no rate limiting; `concurrency` alone already caps requests in flight.
   */
  requestsPerSecond?: number;
}
