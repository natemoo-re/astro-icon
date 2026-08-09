import { AstroError } from "astro/errors";

/**
 * The error astro-icon throws for anything a developer needs to act on -
 * a missing collection, an un-installed pack, a disallowed icon name,
 * malformed SVG, etc. Extends Astro's own user-facing `AstroError` so the
 * `hint` renders through Astro's error overlay/CLI output the same way a
 * first-party error would, instead of surfacing as a bare stack trace.
 */
export class AstroIconError extends AstroError {
  constructor(message: string, hint?: string) {
    super(`[astro-icon] ${message}`, hint);
  }
}
