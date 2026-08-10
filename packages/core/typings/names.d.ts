// Declaration-merged with the generated `.astro/astro-icon.d.ts`; empty until a sync has run.
declare global {
  namespace AstroIcon {
    interface Collections {}
    interface LiveCollections {}
  }
}

type AstroIconPrefixed = {
  [K in keyof AstroIcon.Collections & string]: `${K}:${AstroIcon.Collections[K] & string}`;
}[keyof AstroIcon.Collections & string];

type AstroIconBare = "icons" extends keyof AstroIcon.Collections
  ? AstroIcon.Collections["icons"] & string
  : never;

/**
 * The type checked against `<Icon name="...">`. Generated per project by
 * `astro sync` (or `dev`/`build`) from every collection you define, so
 * autocomplete and type errors only appear after you've synced at least once.
 *
 * Accepts `"collection:icon"` for any defined collection, or a bare icon name
 * if you have one named `icons`. Falls back to a plain `string` until a sync
 * has run.
 */
export type IconName = [AstroIconPrefixed | AstroIconBare] extends [never]
  ? string
  : AstroIconPrefixed | AstroIconBare;

/**
 * The type checked against `<LiveIcon name="...">`. Unlike {@link IconName},
 * it always requires the `"collection:icon"` form since live collections
 * have no default. Falls back to a plain `string` until a sync has run.
 */
export type LiveIconName = [keyof AstroIcon.LiveCollections] extends [never]
  ? string
  : `${keyof AstroIcon.LiveCollections & string}:${string}`;
