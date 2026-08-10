import type { AstroIntegrationLogger } from "astro";
import { AstroIconError } from "./AstroIconError.js";
import type { IconSource } from "./iconSource.js";

export interface ListIconsOrFallbackOptions {
  /** Turns a failed `listIcons()` into a build error instead of a warning + empty list. */
  strict: boolean;
  logger: Pick<AstroIntegrationLogger, "warn">;
  /** Message for a failed `listIcons()` call, given the error's own message as `detail`. */
  failureMessage: (detail: string) => string;
  /** Hint attached to the thrown `AstroIconError` under `strict`. */
  hint: string;
}

/** Calls `source.listIcons()` (falling back to `[]` if absent), throwing under `strict` or warning otherwise on failure. Shared by `createIconLoader` and `localIcons`. */
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
