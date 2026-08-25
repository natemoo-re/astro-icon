/**
 * The best-effort project-root guess used wherever a source needs a root before any loader has a
 * real one to give it - `iconify`'s initial pack load at source construction (before
 * `resolveRoot` fires), and `createLiveIconLoader`, which never gets a real one at all (see
 * `IconSource.resolveRoot`'s doc comment for why "best-effort" is as good as it gets there).
 *
 * `process.cwd()` is only sometimes the project root - `astro build --root <dir>` invoked from
 * elsewhere is a common case where it isn't - so anything using this guess should already be set
 * up to move once a real root shows up (`resolveRoot`), the way `iconify` does.
 */
export function guessProjectRoot(): URL {
  return new URL(`file://${process.cwd()}/`);
}
