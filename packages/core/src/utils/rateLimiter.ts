export interface RateLimiter {
  (): Promise<void>;
}

/**
 * Builds a rate limiter enforcing at most `requestsPerSecond` *starts* globally across every
 * caller sharing the returned function. Not a concurrency cap (see `IconSource.concurrency`,
 * which bounds how many calls are in flight at once) - a concurrency cap alone doesn't bound
 * throughput if calls resolve quickly (N concurrent slots refilling fast enough can still exceed
 * any given rate); this bounds how often a *new* call is allowed to begin, independent of how
 * many are already in flight or how fast they resolve.
 *
 * `await limiter()` before the work being rate-limited; it resolves immediately if enough time
 * has passed since the last call was let through, otherwise after whatever delay is needed to
 * keep the global rate at or under `requestsPerSecond`.
 *
 * Exported from `astro-icon/utils` for a custom `IconSource` that wants to be a good citizen of
 * whatever API or database it talks to - wrap your own `getIcon` with it if you need one.
 */
export function createRateLimiter(requestsPerSecond: number): RateLimiter {
  const intervalMs = 1000 / requestsPerSecond;
  let nextSlot = 0;

  return async function acquire(): Promise<void> {
    const current = Date.now();
    const slot = Math.max(current, nextSlot);
    nextSlot = slot + intervalMs;
    const delay = slot - current;
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  };
}
