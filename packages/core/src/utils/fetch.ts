const inFlightRequests = new Map<string, Promise<unknown>>();

export async function dedupeFetch<T>(getFetchPromise: (key: string) => Promise<T>, ...keys: string[]): Promise<T> {
    const key = keys.join(':');
    if (inFlightRequests.has(key)) {
        console.log('inflight', key)
        return inFlightRequests.get(key) as T;
    }

    const fetchPromise = getFetchPromise(key);
  inFlightRequests.set(key, fetchPromise);

  try {
    const result = await fetchPromise;
    return result;
  } finally {
    inFlightRequests.delete(key);
  }
}