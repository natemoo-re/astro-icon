import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRateLimiter } from "../../src/utils/rateLimiter.js";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createRateLimiter", () => {
  it("lets the first call through immediately", async () => {
    const limiter = createRateLimiter(10); // 100ms interval

    const before = Date.now();
    await limiter();
    expect(Date.now() - before).toBe(0);
  });

  it("spaces back-to-back calls by 1000/requestsPerSecond", async () => {
    const limiter = createRateLimiter(10); // 100ms interval
    const waited: number[] = [];

    for (let i = 0; i < 3; i++) {
      const before = Date.now();
      const done = limiter();
      await vi.runAllTimersAsync();
      await done;
      waited.push(Date.now() - before);
    }

    // First call: no wait. Second/third: each waits the full 100ms interval since calls happen
    // back-to-back with no real time passing between them on the fake clock.
    expect(waited).toEqual([0, 100, 100]);
  });

  it("doesn't wait if enough real time already passed between calls", async () => {
    const limiter = createRateLimiter(10); // 100ms interval

    await limiter();
    await vi.advanceTimersByTimeAsync(150); // more than one interval's worth of "real" time passes
    const before = Date.now();
    await limiter();
    expect(Date.now() - before).toBe(0);
  });

  it("queues concurrent (not sequentially awaited) callers into consecutive slots", async () => {
    const limiter = createRateLimiter(10); // 100ms interval

    // All three start "at once" (no sequential await between them) - each should still land in
    // its own slot, 100ms apart, rather than all going through immediately.
    const all = Promise.all([0, 1, 2].map(() => limiter()));
    await vi.runAllTimersAsync();
    await all;

    expect(Date.now()).toBe(200); // slots at 0ms, 100ms, 200ms
  });

  it("enforces the rate independently across separate rate limiters", async () => {
    const a = createRateLimiter(10);
    const b = createRateLimiter(10);

    const before = Date.now();
    await a();
    await b();
    // Two different limiter instances don't share state - both let their first call through
    // immediately.
    expect(Date.now() - before).toBe(0);
  });
});
