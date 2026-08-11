import type { AstroIntegrationLogger } from "astro";

/** Fallback logger for code with no `AstroIntegrationLogger` in scope (e.g. an `IconSource` called directly); prefer `context.logger` inside a loader's `load()`. */
export const consoleLogger: Pick<AstroIntegrationLogger, "warn" | "debug"> = {
  warn: (message: string) => console.warn(`[astro-icon] ${message}`),
  debug: (message: string) => console.debug(`[astro-icon] ${message}`),
};
