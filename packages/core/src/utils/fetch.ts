export interface FetchWithRetryOptions {
  /** How many retries to attempt after the initial request, on top of a retryable status. */
  maxRetries?: number;
  /**
   * Base delay (ms) for exponential backoff between retries, doubled each attempt. Only used
   * when the response has no numeric `Retry-After` header to honor instead.
   */
  baseDelayMs?: number;
  /**
   * Response statuses worth retrying automatically. Anything else (including a network failure)
   * is returned/resolved as-is on the first try - only these are treated as "try again", not a
   * permanent failure.
   */
  retryStatuses?: number[];
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_RETRY_STATUSES = [429];

/**
 * `fetch`, retrying a retryable response status (429 by default - a server telling you to slow
 * down, not a permanent failure) up to `maxRetries` times. Waits for the delay the server itself
 * asked for via `Retry-After` (the numeric-seconds form; the less common HTTP-date form isn't
 * handled and falls through to backoff instead) when present, otherwise a doubling backoff from
 * `baseDelayMs`. Any non-retryable status, or a network failure, is returned/resolved as-is on
 * the first try.
 *
 * Resolves `undefined` only on a network failure (the underlying `fetch` rejecting); an HTTP
 * error status still resolves a `Response` you can inspect (`res.ok`, `res.status`, ...).
 *
 * Exported from `astro-icon/utils` for a custom `IconSource` talking to its own rate-limited
 * API; `iconifyApiSource` uses this internally against the public Iconify API.
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: FetchWithRetryOptions = {},
): Promise<Response | undefined> {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    retryStatuses = DEFAULT_RETRY_STATUSES,
  } = options;

  async function attempt(count: number): Promise<Response | undefined> {
    const res = await (init ? fetch(input, init) : fetch(input)).catch(
      () => undefined,
    );
    if (!res) return undefined;
    if (!retryStatuses.includes(res.status) || count >= maxRetries) return res;

    const retryAfterHeader = res.headers.get("retry-after");
    // `Number(null)` is 0, not NaN, so a missing header has to be checked for explicitly rather
    // than relying on Number.isFinite to reject it.
    const retryAfterSeconds =
      retryAfterHeader == null ? NaN : Number(retryAfterHeader);
    const delayMs = Number.isFinite(retryAfterSeconds)
      ? retryAfterSeconds * 1000
      : baseDelayMs * 2 ** count;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return attempt(count + 1);
  }

  return attempt(0);
}

/** Thrown by {@link fetchJSON} for anything short of a successful, JSON-parseable response. */
export class FetchJSONError extends Error {
  constructor(
    message: string,
    /** The failed response, if the request reached the server at all (absent on a network failure). */
    public readonly response?: Response,
  ) {
    super(message);
    this.name = "FetchJSONError";
  }
}

/**
 * A `fetch` wrapper for the common "hit a JSON API" case, smoothing over the parts of plain
 * `fetch` that are easy to get wrong: it doesn't reject on an HTTP error status (you have to
 * check `res.ok` yourself), and `res.json()` throws an unhelpful `SyntaxError` on a non-JSON
 * body instead of naming the request that caused it.
 *
 * Retries a retryable status (see {@link fetchWithRetry}) before giving up, then throws a
 * {@link FetchJSONError} for a network failure, a non-OK status, or a body that isn't valid
 * JSON. Resolves the parsed body (typed as `T` - not validated, just cast) on success.
 *
 * Exported from `astro-icon/utils` for a custom `IconSource` fetching from its own JSON API.
 */
export async function fetchJSON<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: FetchWithRetryOptions,
): Promise<T> {
  const res = await fetchWithRetry(input, init, options);
  if (!res) {
    throw new FetchJSONError(`Network failure fetching "${String(input)}".`);
  }
  if (!res.ok) {
    throw new FetchJSONError(
      `"${String(input)}" responded ${res.status} ${res.statusText}.`,
      res,
    );
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new FetchJSONError(
      `"${String(input)}" did not respond with valid JSON.`,
      res,
    );
  }
}
