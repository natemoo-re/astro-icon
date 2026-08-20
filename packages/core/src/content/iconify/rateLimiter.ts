export interface RateLimiter {
  (): Promise<void>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
 * Internal only for now: not wired into any `IconSource` by default, and not exported from the
 * package's public entrypoints (`astro-icon`, `astro-icon/loaders`). A caller wanting this today
 * would need to import this module path directly and wrap their own source's `getIcon` with it.
 */
export function createRateLimiter(requestsPerSecond: number): RateLimiter {
  const intervalMs = 1000 / requestsPerSecond;
  let nextSlot = 0;

  return async function acquire(): Promise<void> {
    const current = Date.now();
    const slot = Math.max(current, nextSlot);
    nextSlot = slot + intervalMs;
    const delay = slot - current;
    if (delay > 0) await sleep(delay);
  };
}
