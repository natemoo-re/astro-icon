// Declaration-merged with the generated `.astro/astro-icon.d.ts`; empty until a sync has run.
declare global {
  namespace AstroIcon {
    interface Collections {}
    interface LiveCollections {}
    interface Packs {}
  }
}

type AstroIconPrefixed = {
  [K in keyof AstroIcon.Collections & string]: `${K}:${AstroIcon.Collections[K] & string}`;
}[keyof AstroIcon.Collections & string];

// `"icons" extends keyof T ? T["icons"] : never` fails to narrow the indexed
// access when T is a concrete (non-generic) type: TypeScript only defers a
// conditional type's evaluation - and carries the `extends` narrowing into
// its branches - when the checked type is a naked generic parameter.
// Routing through this generic keeps `AstroIcon.Collections` as a type
// argument so the narrowing actually applies; inlined, it silently resolves
// to `any` instead of erroring, collapsing all of `IconName` to `any`.
type KeyOrNever<T, K extends PropertyKey> = K extends keyof T ? T[K] : never;

type AstroIconBare = KeyOrNever<AstroIcon.Collections, "icons"> & string;

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

/**
 * The icon names valid for an Iconify `pack`, recorded from that pack's full
 * (unfiltered) catalog the first time `iconify()`/`iconifySource()` resolves
 * it locally. Used to type and autocomplete the `icons: [...]` option
 * against the real pack contents. Falls back to a plain `string` until a
 * sync has run, or if `pack` isn't a literal known to have been recorded.
 */
export type IconifyIconName<Pack extends string> = Pack extends keyof AstroIcon.Packs
  ? AstroIcon.Packs[Pack] & string
  : string;
