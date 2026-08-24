export interface IconifyApiPolicyOptions {
  /** Max automatic retries on a 429 before giving up. */
  maxRetries?: number;
  /** Base delay (ms) for the retry backoff, doubled on each attempt past the first. */
  baseRetryDelayMs?: number;
}

export interface IconifyApiPolicy {
  /** `fetch`, honoring this policy's 429 retry/backoff. */
  fetch(url: string): Promise<Response | undefined>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * How a request to the Iconify API recovers from a 429: a shared public service telling us to
 * slow down is not a permanent failure - worth a few retries with backoff before giving up,
 * unlike any other error status (a 404 or a malformed pack name won't start working on retry,
 * so those still resolve/reject as-is on the first try).
 *
 * Distinct from `IconSource.concurrency` (`buildIcons`'s cap on in-flight `getIcon` calls) - this
 * governs the HTTP layer underneath, independent of how many `getIcon` calls happen to be
 * in flight at once.
 */
export function createIconifyApiPolicy(
  options: IconifyApiPolicyOptions = {},
): IconifyApiPolicy {
  const { maxRetries = 3, baseRetryDelayMs = 500 } = options;

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
    fetch(url) {
      return fetchWithRetry(url);
    },
  };
}
