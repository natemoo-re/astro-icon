import type { AstroIntegrationLogger } from "astro";

/**
 * Fallback logger for code that runs outside a loader's `load()` - an
 * `IconSource` called directly, or `createLiveIconLoader`, which resolves
 * icons per-request in production with no `AstroIntegrationLogger` in
 * scope. Matches the `warn` subset of `AstroIntegrationLogger` so either can
 * be passed wherever a logger is expected.
 *
 * Inside a loader's `load()`, prefer the real `context.logger` instead -
 * Astro already labels its output with the loader's name, so messages
 * passed to it shouldn't repeat an "[astro-icon]" prefix (this one adds its
 * own, since plain `console.warn` has no labelling of its own).
 */
export const consoleLogger: Pick<AstroIntegrationLogger, "warn"> = {
  warn: (message: string) => console.warn(`[astro-icon] ${message}`),
};
