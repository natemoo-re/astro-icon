import { createRateLimiter } from "./rateLimiter.js";

export interface IconifyApiPolicyOptions {
  /** Max automatic retries on a 429 before giving up. */
  maxRetries?: number;
  /** Base delay (ms) for the retry backoff, doubled on each attempt past the first. */
  baseRetryDelayMs?: number;
  /**
   * Caps how many *new* requests may start per second (see `createRateLimiter`), independent of
   * how many are already in flight or how fast they resolve. Omit for no rate limiting - the
   * default, matching behavior before this policy existed.
   */
  requestsPerSecond?: number;
}

export interface IconifyApiPolicy {
  /** `fetch`, honoring this policy's rate limit (if any) and 429 retry/backoff. */
  fetch(url: string): Promise<Response | undefined>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Bundles every "how fast can we hit the Iconify API" concern into one policy: an optional rate
 * limiter gating how often a *new* request may begin, and a 429 retry/backoff gating how an
 * individual request recovers once it's already been let through. A 429 is a shared public
 * service telling us to slow down, not a permanent failure - worth a few retries before giving
 * up, unlike any other error status (a 404 or a malformed pack name won't start working on
 * retry, so those still resolve/reject as-is on the first try).
 *
 * Distinct from `IconSource.concurrency` (`buildIcons`'s cap on in-flight `getIcon` calls) - this
 * governs the HTTP layer underneath, independent of how many `getIcon` calls happen to be
 * in flight at once.
 */
export function createIconifyApiPolicy(
  options: IconifyApiPolicyOptions = {},
): IconifyApiPolicy {
  const { maxRetries = 3, baseRetryDelayMs = 500, requestsPerSecond } = options;
  const limiter = requestsPerSecond
    ? createRateLimiter(requestsPerSecond)
    : undefined;

  async function fetchWithRetry(
    url: string,
    attempt = 0,
  ): Promise<Response | undefined> {
    const res = await fetch(url).catch(() => undefined);
    if (!res) return undefined;
    if (res.status !== 429 || attempt >= maxRetries) return res;

    const retryAfterHeader = res.headers.get("retry-after");
    // `Number(null)` is 0, not NaN, so a missing header has to be checked for explicitly rather
    // than relying on Number.isFinite to reject it.
    const retryAfterSeconds =
      retryAfterHeader == null ? NaN : Number(retryAfterHeader);
    const delayMs = Number.isFinite(retryAfterSeconds)
      ? retryAfterSeconds * 1000
      : baseRetryDelayMs * 2 ** attempt;
    await sleep(delayMs);
    return fetchWithRetry(url, attempt + 1);
  }

  return {
    async fetch(url) {
      if (limiter) await limiter();
      return fetchWithRetry(url);
    },
  };
}
