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
