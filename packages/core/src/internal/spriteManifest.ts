/**
 * One collection's entry in the runtime sprite manifest. Written by the
 * sprite integration (`src/content/sprite/manifest.ts`), read by `<Icon>`
 * (`src/render/spriteMode.ts`) - the one type both the content and render
 * contexts share, same reason `AstroIconError` lives here instead of in
 * either one.
 *
 * `assetIcons` is `"all"` until asset emission (a later step) computes a
 * real subset.
 */
export interface SpriteManifestEntry {
  hash: string;
  assetIcons: "all" | string[];
}

export type SpriteManifest = Record<string, SpriteManifestEntry>;

/**
 * The id shared by a `<symbol>` and every `<use>` referencing it. Namespaced
 * by collection so an asset (which mixes only one collection, but is
 * referenced from pages that may render several) stays collision-free.
 * `:`/`/` are replaced with `-` since they aren't valid in an XML `NCName`
 * (see astro-icon#215) - the same format `<Sprite>`'s own id scheme used.
 */
export function spriteSymbolId(collection: string, name: string): string {
  return `ai-${collection}-${name}`.replace(/[:/]/g, "-");
}

/**
 * The public path a collection's sprite asset is served/emitted at. One
 * function so `<Icon>` (constructing an `href`) and the integration
 * (serving/emitting the file) can never disagree on the URL shape.
 */
export function spriteAssetPath(collection: string, hash: string): string {
  return `/_astro/${collection}.${hash}.svg`;
}
