import type { AstroIntegrationLogger } from "astro";
import { AstroIconError } from "../internal/error.js";
import type { IconSource } from "./source.js";

export interface ListIconsOrFallbackOptions {
  /** Turns a failed `checkPreconditions()`/`listIcons()` into a build error instead of a warning + empty list. */
  strict: boolean;
  logger: Pick<AstroIntegrationLogger, "warn">;
  /** Message for a failed `checkPreconditions()`/`listIcons()` call, given the error's own message as `detail`. */
  failureMessage: (detail: string) => string;
  /** Hint attached to the thrown `AstroIconError` under `strict`. */
  hint: string;
}

/**
 * Calls `source.checkPreconditions()` first if present (see `IconSource.checkPreconditions`'s doc comment - is this
 * source usable at all, as a distinct concern from what it lists), then `source.listIcons()`
 * (falling back to `[]` if absent), throwing under `strict` or warning otherwise if either fails.
 * Used by `createIconLoader`.
 */
export async function listIconsOrFallback(
  source: Pick<IconSource, "listIcons" | "checkPreconditions">,
  { strict, logger, failureMessage, hint }: ListIconsOrFallbackOptions,
): Promise<string[]> {
  try {
    await source.checkPreconditions?.();
    return source.listIcons ? await source.listIcons() : [];
  } catch (ex) {
    const message = failureMessage(
      ex instanceof Error ? ex.message : String(ex),
    );
    if (strict) {
      throw new AstroIconError(message, hint);
    }
    logger.warn(message);
    return [];
  }
}
