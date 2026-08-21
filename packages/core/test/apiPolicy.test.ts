import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createIconifyApiPolicy } from "../src/content/iconify/apiPolicy.js";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("createIconifyApiPolicy / retry", () => {
  it("returns a successful response on the first try untouched", async () => {
    const fetchMock = vi.fn(
      async () => new Response("ok", { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const policy = createIconifyApiPolicy();

    const res = await policy.fetch("https://api.iconify.design/mdi.json");

    expect(res?.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("doesn't retry a non-429 failure", async () => {
    const fetchMock = vi.fn(
      async () => new Response("Not Found", { status: 404 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const policy = createIconifyApiPolicy();

    const res = await policy.fetch("https://api.iconify.design/mdi.json");

    expect(res?.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("retries a 429 up to maxRetries, honoring Retry-After", async () => {
    const timestamps: number[] = [];
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        timestamps.push(Date.now());
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
    const policy = createIconifyApiPolicy();

    const resultPromise = policy.fetch("https://api.iconify.design/mdi.json");
    await vi.runAllTimersAsync();
    const res = await resultPromise;

    expect(res?.status).toBe(200);
    expect(timestamps).toEqual([0, 2000]);
  });

  it("gives up after maxRetries", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    const policy = createIconifyApiPolicy({ maxRetries: 2 });

    const resultPromise = policy.fetch("https://api.iconify.design/mdi.json");
    await vi.runAllTimersAsync();
    const res = await resultPromise;

    expect(res?.status).toBe(429);
    // 2 retries after the initial attempt = 3 fetches total.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("createIconifyApiPolicy / rate limiting", () => {
  it("doesn't space requests when requestsPerSecond is omitted", async () => {
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const policy = createIconifyApiPolicy();

    await Promise.all([
      policy.fetch("https://api.iconify.design/a.json"),
      policy.fetch("https://api.iconify.design/b.json"),
    ]);

    expect(Date.now()).toBe(0);
  });

  it("spaces new requests at requestsPerSecond", async () => {
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const policy = createIconifyApiPolicy({ requestsPerSecond: 10 }); // 100ms interval

    const acquired = Promise.all([
      policy.fetch("https://api.iconify.design/a.json"),
      policy.fetch("https://api.iconify.design/b.json"),
    ]);
    await vi.runAllTimersAsync();
    await acquired;

    expect(Date.now()).toBe(100); // slots at 0ms, 100ms
  });
});
