import { AstroIconError } from "./internal/error.js";
import type { OptimizeFn } from "../typings/types";

// SVGO's own config shape, kept loose here rather than importing SVGO's types: this module must
// load without `svgo` installed (it's an optional peer, only required once `svgo()` is called),
// and pulling in its types would pull in a hard dependency on its presence for type-checking too.
export interface SvgoOptions {
  multipass?: boolean;
  floatPrecision?: number;
  plugins?: unknown[];
  [key: string]: unknown;
}

/**
 * The `overrides` astro-icon's `svgo()` default applies on top of SVGO's
 * `preset-default`, turning off every plugin that can change how an icon
 * *looks* or *what elements exist* in ways a reasonable author could
 * disagree with - as opposed to purely mechanical cleanup (whitespace,
 * precision, structurally-empty nodes) that can't be "wrong" for a
 * legitimate icon. Exported so a caller can extend it (`{ ...defaultOverrides, myPlugin: false }`)
 * instead of retyping the whole list to add one more override.
 *
 * Off, and why:
 * - `removeComments`, `removeMetadata` - may carry a required license notice (e.g. Font Awesome's
 *   CC BY 4.0 attribution); astro-icon's own local-icon pipeline was burned by a tool that
 *   stripped these unconditionally (see the "Local icons" section of the README).
 * - `convertColors`, `removeUselessStrokeAndFill` - touch color/paint; astro-icon never rewrites
 *   an icon's color automatically (see "Styling icons" in the README) and an `optimize` default
 *   shouldn't quietly do what the library itself deliberately doesn't.
 * - `cleanupIds`, `removeDesc` - ids and `<desc>` may be referenced or relied on outside astro-icon
 *   (external CSS/JS `url(#id)` references, accessibility tooling).
 * - `removeUselessDefs`, `removeUnknownsAndDefaults`, `removeNonInheritableGroupAttrs`,
 *   `removeHiddenElems` - each removes content based on a heuristic that can misjudge (an element
 *   referenced in a way the plugin's static analysis can't see, or a newer attribute it doesn't
 *   recognize).
 * - `mergeStyles`, `inlineStyles`, `minifyStyles` - restructure `<style>` blocks in ways that can
 *   change CSS cascade/specificity behavior.
 * - `convertShapeToPath`, `convertEllipseToCircle`, `moveElemsAttrsToGroup`, `moveGroupAttrsToElems`,
 *   `collapseGroups`, `convertPathData`, `convertTransform`, `mergePaths` - structural rewrites:
 *   change element types or DOM shape (breaking an external `rect`/`circle`/`g` CSS selector) or
 *   recompute geometry (a real, if usually small, rendering risk).
 */
export const defaultOverrides: Record<string, false> = {
  removeComments: false,
  removeMetadata: false,
  convertColors: false,
  removeUselessStrokeAndFill: false,
  cleanupIds: false,
  removeDesc: false,
  removeUselessDefs: false,
  removeUnknownsAndDefaults: false,
  removeNonInheritableGroupAttrs: false,
  removeHiddenElems: false,
  mergeStyles: false,
  inlineStyles: false,
  minifyStyles: false,
  convertShapeToPath: false,
  convertEllipseToCircle: false,
  moveElemsAttrsToGroup: false,
  moveGroupAttrsToElems: false,
  collapseGroups: false,
  convertPathData: false,
  convertTransform: false,
  mergePaths: false,
};

// `floatPrecision` lives inside the preset's own `params`, not SVGO's top-level config: a
// preset's `fn` only reads `floatPrecision`/`overrides` off the params it was itself given.
const defaultPlugins = [
  {
    name: "preset-default",
    params: { floatPrecision: 3, overrides: defaultOverrides },
  },
];

let svgoModule: typeof import("svgo") | undefined;

async function loadSvgo(): Promise<typeof import("svgo")> {
  if (svgoModule) return svgoModule;
  try {
    svgoModule = await import("svgo");
    return svgoModule;
  } catch {
    throw new AstroIconError(
      `"svgo" isn't installed, but the "svgo()" optimize helper from "astro-icon/optimize" was used.`,
      `Install it with \`npm install svgo\`.`,
    );
  }
}

/**
 * An `OptimizeFn` (see `optimize` on {@link iconify}, {@link localIcons}, and friends) that runs
 * an icon's SVG through SVGO. `svgo` is an optional peer dependency - install it yourself, this
 * helper only imports it lazily when actually called.
 *
 * With no arguments, runs SVGO's `preset-default` with {@link defaultOverrides} layered on top:
 * mechanical cleanup only (whitespace, numeric precision, structurally-empty nodes), nothing that
 * changes an icon's color or DOM shape.
 *
 * `options` is SVGO's own config object, passed through as-is on top of that default - so passing
 * `plugins` replaces the default list entirely (e.g. `svgo({ plugins: ["preset-default"] })` for
 * SVGO's own untouched default), rather than merging with it. To keep most of astro-icon's
 * defaults and adjust one plugin, build on {@link defaultOverrides} yourself:
 *
 * ```ts
 * import { svgo, defaultOverrides } from "astro-icon/optimize";
 *
 * optimize: svgo({
 *   plugins: [
 *     {
 *       name: "preset-default",
 *       params: { overrides: { ...defaultOverrides, convertColors: { currentColor: true } } },
 *     },
 *   ],
 * })
 * ```
 */
export function svgo(options: SvgoOptions = {}): OptimizeFn {
  const config = {
    multipass: false,
    plugins: defaultPlugins,
    ...options,
  };

  return async (svg) => {
    const { optimize } = await loadSvgo();
    // `config.plugins` is intentionally untyped against SVGO's own `Config` (see `SvgoOptions`),
    // so this module type-checks without `svgo` installed; the real shape is enforced by SVGO
    // itself at runtime, and by this package's own devDependency-backed test suite.
    return optimize(svg, config as Parameters<typeof optimize>[1]).data;
  };
}
