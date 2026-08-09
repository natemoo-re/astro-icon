import type { AstroIntegrationLogger } from "astro";
import { AstroIconError } from "./AstroIconError.js";
import type { IconSource } from "./iconSource.js";

export interface ListIconsOrFallbackOptions {
  /** Turns a failed `listIcons()` into a build error instead of a warning + empty list. */
  strict: boolean;
  logger: Pick<AstroIntegrationLogger, "warn">;
  /** Message for a failed `listIcons()` call - given the error's own message as `detail`. */
  failureMessage: (detail: string) => string;
  /** Hint attached to the thrown `AstroIconError` under `strict`. */
  hint: string;
}

/**
 * Calls `source.listIcons()`, if it has one, applying every loader's shared
 * policy for a failure: throw under `strict`, otherwise warn and fall back
 * to an empty list. A source with no `listIcons()` also falls back to `[]`
 * (it just can't enumerate itself - not treated as a failure).
 *
 * Shared by `createIconLoader` and `localIcons` - a build collection always
 * needs this exact same "list or fall back" policy before it can load
 * anything.
 */
export async function listIconsOrFallback(
  source: Pick<IconSource, "listIcons">,
  { strict, logger, failureMessage, hint }: ListIconsOrFallbackOptions,
): Promise<string[]> {
  if (!source.listIcons) return [];
  try {
    return await source.listIcons();
  } catch (ex) {
    const message = failureMessage(ex instanceof Error ? ex.message : String(ex));
    if (strict) {
      throw new AstroIconError(message, hint);
    }
    logger.warn(message);
    return [];
  }
}
