/** Tracks whether a `<Sprite>` has already rendered for this request, for the dev-only "multiple `<Sprite>`" warning. */
export const spriteRenderedForRequest = new WeakMap<Request, boolean>();
