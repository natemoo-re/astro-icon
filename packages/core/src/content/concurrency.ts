/**
 * Runs `worker` over `items`, at most `limit` calls in flight at once (every item at once if
 * `limit` is omitted or exceeds `items.length`). Order-preserving: `results[i]` corresponds to
 * `items[i]` regardless of which order the workers actually finish in.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number | undefined,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];

  const results = new Array<R>(items.length);
  const workerCount = Math.max(
    1,
    Math.min(limit ?? items.length, items.length),
  );
  let next = 0;

  async function run(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index] as T, index);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, run));
  return results;
}

/** A function that runs `fn`, queuing it if the gate's limit is already saturated. */
export interface ConcurrencyGate {
  <T>(fn: () => Promise<T>): Promise<T>;
}

/**
 * Builds a gate gating at most `limit` calls to run `fn` at once *across every call to the
 * returned function*, queuing the rest in call order - unlike `mapWithConcurrency`, which caps
 * one fixed batch of work, this is meant for throttling calls arriving over time from unrelated
 * callers against one shared-capacity resource.
 */
export function createConcurrencyGate(limit: number): ConcurrencyGate {
  let active = 0;
  const queue: Array<() => void> = [];

  function acquire(): Promise<void> {
    if (active < limit) {
      active++;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      queue.push(() => {
        active++;
        resolve();
      });
    });
  }

  function release(): void {
    active--;
    queue.shift()?.();
  }

  return async function withGate<T>(fn: () => Promise<T>): Promise<T> {
    await acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  };
}
