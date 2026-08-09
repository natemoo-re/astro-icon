// Declaration-merged with the generated `.astro/astro-icon.d.ts`, produced by
// the loaders in `astro-icon/loaders` on `astro sync` / dev / build. Until a
// sync has run (or if a project doesn't reference the generated file from
// `src/env.d.ts`), these interfaces are empty and `IconName`/`LiveIconName`
// fall back to `string`.
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

export type IconName = [AstroIconPrefixed | AstroIconBare] extends [never]
  ? string
  : AstroIconPrefixed | AstroIconBare;

export type LiveIconName = [keyof AstroIcon.LiveCollections] extends [never]
  ? string
  : `${keyof AstroIcon.LiveCollections & string}:${string}`;
