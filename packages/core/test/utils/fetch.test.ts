import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchJSON,
  FetchJSONError,
  fetchWithRetry,
} from "../../src/utils/fetch.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchWithRetry", () => {
  it("resolves a successful response on the first try", async () => {
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await fetchWithRetry("https://example.com");

    expect(res?.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("resolves undefined on a network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    await expect(
      fetchWithRetry("https://example.com"),
    ).resolves.toBeUndefined();
  });

  it("doesn't retry a status outside retryStatuses", async () => {
    const fetchMock = vi.fn(
      async () => new Response("Not Found", { status: 404 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await fetchWithRetry("https://example.com");

    expect(res?.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  describe("retrying a retryable status", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(0);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("retries a default-retryable 429 after Retry-After, then succeeds", async () => {
      let call = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          call++;
          if (call === 1) {
            return new Response("", {
              status: 429,
              headers: { "retry-after": "2" },
            });
          }
          return new Response("ok", { status: 200 });
        }),
      );

      const before = Date.now();
      const pending = fetchWithRetry("https://example.com");
      await vi.runAllTimersAsync();
      const res = await pending;

      expect(res?.status).toBe(200);
      expect(Date.now() - before).toBe(2000);
    });

    it("falls back to doubling backoff from baseDelayMs when Retry-After is absent", async () => {
      let call = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          call++;
          if (call <= 2) return new Response("", { status: 429 });
          return new Response("ok", { status: 200 });
        }),
      );

      const before = Date.now();
      const pending = fetchWithRetry("https://example.com", undefined, {
        baseDelayMs: 100,
      });
      await vi.runAllTimersAsync();
      await pending;

      // Doubling from a 100ms base: first retry waits 100ms, second waits 200ms.
      expect(Date.now() - before).toBe(300);
    });

    it("gives up after maxRetries", async () => {
      const fetchMock = vi.fn(async () => new Response("", { status: 429 }));
      vi.stubGlobal("fetch", fetchMock);

      const pending = fetchWithRetry("https://example.com", undefined, {
        maxRetries: 2,
      });
      await vi.runAllTimersAsync();
      const res = await pending;

      expect(res?.status).toBe(429);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("honors a custom retryStatuses list", async () => {
      let call = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          call++;
          if (call === 1) return new Response("", { status: 503 });
          return new Response("ok", { status: 200 });
        }),
      );

      const pending = fetchWithRetry("https://example.com", undefined, {
        retryStatuses: [503],
      });
      await vi.runAllTimersAsync();
      const res = await pending;

      expect(res?.status).toBe(200);
    });
  });
});

describe("fetchJSON", () => {
  it("resolves the parsed JSON body on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ hello: "world" }), { status: 200 }),
      ),
    );

    await expect(fetchJSON("https://example.com")).resolves.toEqual({
      hello: "world",
    });
  });

  it("throws FetchJSONError on a network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    await expect(fetchJSON("https://example.com")).rejects.toThrow(
      FetchJSONError,
    );
  });

  it("throws FetchJSONError with the response attached on a non-OK status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Not Found", { status: 404 })),
    );

    await expect(fetchJSON("https://example.com")).rejects.toMatchObject({
      name: "FetchJSONError",
      response: expect.objectContaining({ status: 404 }),
    });
  });

  it("throws FetchJSONError on a body that isn't valid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not json", { status: 200 })),
    );

    await expect(fetchJSON("https://example.com")).rejects.toThrow(
      FetchJSONError,
    );
  });
});
