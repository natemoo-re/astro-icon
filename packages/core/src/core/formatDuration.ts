/**
 * Formats a duration in milliseconds the same way Astro's own build/sync
 * timers do (see `getTimeStat` in `astro/dist/core/build/util.js`): plain
 * milliseconds under a second, otherwise seconds to two decimal places.
 * Keeping the same convention means our timing logs read consistently next
 * to Astro's own "Synced content"-style output.
 */
export function formatDuration(durationMs: number): string {
  return durationMs < 1000 ? `${Math.round(durationMs)}ms` : `${(durationMs / 1000).toFixed(2)}s`;
}
