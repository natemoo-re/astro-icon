/**
 * The shape every icon collection stores in Astro's content layer, and what
 * `entry.data` gives you from `getEntry()` or `getLiveEntry()`.
 *
 * You won't normally construct this yourself: a loader (`iconify`,
 * `localSource`, or a custom {@link IconSource}) builds it for you from raw
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
  /**
   * Default `title` prop for `<Icon>`/`<LiveIcon>`, honored only when the caller doesn't pass
   * their own. `localSource()` populates this from the icon's own inline `<title>`, if it had one.
   */
  title?: string;
  /** Default `desc` prop, same override relationship as {@link title}. */
  desc?: string;
  [key: string]: string | number | undefined;
}

/**
 * A hook to transform an icon's raw SVG markup before astro-icon parses and
 * stores it. Common uses: running it through SVGO, stripping hardcoded
 * `fill`/`stroke` colors so CSS can control them, or adding `aria-hidden`.
 *
 * Pass one via the `optimize` option on {@link localSource}. Iconify sources
 * never have a raw SVG string to hand it (they build an `IconEntry` straight
 * out of structured Iconify icon data) - reach for {@link TransformFn}
 * there instead.
 */
export type OptimizeFn = (
  svg: string,
  ctx: { collection: string; name: string },
) => string | Promise<string>;

/**
 * A hook to transform an icon's already-built `IconEntry` - the last step
 * every source applies before returning it, after any source-specific
 * policy (like {@link localSource}'s `optimize`) has already run. The one
 * transform hook every {@link IconSource} kind shares, since unlike
 * `OptimizeFn` it doesn't assume there's a raw SVG string in play.
 *
 * Common uses: recoloring (`entry.body.replaceAll('stroke-width="2"', 'stroke-width="1.5"')`),
 * adding a field every icon in a collection should have, or normalizing
 * fields a design system's `<Icon>` usage relies on.
 */
export type TransformFn = (
  entry: IconEntry,
  ctx: { collection: string; name: string },
) => IconEntry | Promise<IconEntry>;

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
  allowed?: string[];
  /** Transform applied to each icon's built `IconEntry`, last, before it's returned. */
  transform?: TransformFn;
}
