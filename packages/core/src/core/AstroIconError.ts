import { AstroError } from "astro/errors";
import type { IconSource } from "./iconSource.js";

/**
 * The error astro-icon throws for problems you need to fix: a missing
 * collection, an uninstalled icon pack, an icon name that isn't allowed,
 * malformed SVG.
 *
 * It extends Astro's own {@link AstroError}, so `hint` renders through
 * Astro's dev overlay and CLI output the same way a first-party Astro error
 * does, instead of surfacing as a bare stack trace.
 *
 * Throw it from a custom {@link IconSource} to get the same treatment as
 * astro-icon's built-in sources.
 */
export class AstroIconError extends AstroError {
  /**
   * @param message What went wrong, shown as the error title.
   * @param hint Optional guidance on how to fix it, shown below the message.
   */
  constructor(message: string, hint?: string) {
    super(`[astro-icon] ${message}`, hint);
  }
}

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
