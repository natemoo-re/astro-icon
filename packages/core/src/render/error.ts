import { AstroIconError } from "../internal/error.js";

/**
 * Builds an {@link AstroIconError} whose hint is dropped outside dev.
 *
 * Use this for errors that can be thrown while rendering a response (`<Icon>`,
 * `<LiveIcon>`, `<Sprite>`), as opposed to only during `astro sync`/`dev`/`build` -
 * a render-time throw can happen on a production SSR request, where the hint's
 * internal detail (paths, collection names) would otherwise leak into a real
 * response instead of staying developer-only CLI output.
 */
export function renderTimeError(message: string, hint: string): AstroIconError {
  return new AstroIconError(message, import.meta.env.DEV ? hint : undefined);
}
