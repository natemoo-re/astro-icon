import { AstroError } from "astro/errors";

/**
 * The error astro-icon throws for problems you need to fix: a missing
 * collection, an uninstalled icon pack, an icon name that isn't allowed,
 * malformed SVG.
 *
 * It extends Astro's own {@link AstroError}, so `hint` renders through
 * Astro's dev overlay and CLI output the same way a first-party Astro error
 * does, instead of surfacing as a bare stack trace.
 *
 * Throw it from a custom `IconSource` to get the same treatment as
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
