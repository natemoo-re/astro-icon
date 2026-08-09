/**
 * Tracks only whether a `<Sprite>` has already rendered for this request -
 * used solely for the dev-only "more than one <Sprite> per page" warning.
 * Unlike the old per-icon dedup cache this replaces, it carries no icon
 * identity at all.
 */
export const spriteRenderedForRequest = new WeakMap<Request, boolean>();
