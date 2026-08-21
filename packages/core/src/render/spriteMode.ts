import type { SpriteManifestEntry } from "../internal/spriteManifest.js";
import { spriteAssetPath, spriteSymbolId } from "../internal/spriteManifest.js";

export type SpriteRenderMode =
  | { kind: "inline" }
  | { kind: "prerendered" }
  | { kind: "asset"; href: string }
  /** Sprited on this collection, but not present in the emitted asset - a caller (`<Icon>`) must throw, not fall back, since a silent fallback would hide a real configuration error. */
  | { kind: "missing-from-asset" };

export interface SpriteRenderModeInput {
  /** The caller opted this one usage out via the `inline` prop. */
  inline: boolean;
  /** This collection's manifest entry, or `undefined` if it's not sprited (no integration, `sprite: false`, or an unknown collection). */
  manifestEntry: SpriteManifestEntry | undefined;
  isPrerendered: boolean;
  collection: string;
  name: string;
  /**
   * `build.assetsPrefix` resolved for `.svg`, if the project serves assets
   * from a different origin (e.g. a CDN). Prepended to the asset href so it
   * still resolves - without this, a project using `assetsPrefix` would get
   * a broken `<use>` pointing at its own origin's `/_astro/...` instead of
   * the CDN's, since sprite assets are copied straight into the client
   * output directory rather than going through Vite's normal asset
   * pipeline (which is what applies `assetsPrefix` to Astro's own emitted
   * `<script>`/`<link>` tags).
   */
  assetsPrefix: string | undefined;
}

/**
 * Decides how one `<Icon>` usage renders, from static facts only - no
 * sibling state, no render order, no per-request tracking. Prerendered
 * pages always render plain inline markup; a later build step rewrites
 * repeated icons into `<symbol>`/`<use>`. Server-rendered pages reference
 * the sprite asset directly, since there's no build pass to rewrite a live
 * response.
 */
export function resolveSpriteRenderMode(
  input: SpriteRenderModeInput,
): SpriteRenderMode {
  const { inline, manifestEntry, isPrerendered } = input;

  if (inline || !manifestEntry) {
    return { kind: "inline" };
  }

  if (isPrerendered) {
    return { kind: "prerendered" };
  }

  if (!inAsset(manifestEntry, input.name)) {
    return { kind: "missing-from-asset" };
  }

  return {
    kind: "asset",
    href: `${input.assetsPrefix ?? ""}${spriteAssetPath(input.collection, manifestEntry.hash)}#${spriteSymbolId(input.collection, input.name)}`,
  };
}

function inAsset(entry: SpriteManifestEntry, name: string): boolean {
  return entry.assetIcons === "all" || entry.assetIcons.includes(name);
}

export { spriteSymbolId };
