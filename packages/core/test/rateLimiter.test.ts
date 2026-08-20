import { afterEach, describe, expect, it } from "vitest";
import {
  __resetClock,
  __setClock,
  createRateLimiter,
} from "../src/content/iconify/rateLimiter.js";

/** A fake clock where `sleep(ms)` advances time by exactly `ms` and resolves immediately, so tests are deterministic and instant. */
function installFakeClock() {
  let current = 0;
  __setClock(
    () => current,
    async (ms) => {
      current += ms;
    },
  );
  return {
    now: () => current,
    advance(ms: number) {
      current += ms;
    },
  };
}

afterEach(() => {
  __resetClock();
});

describe("createRateLimiter", () => {
  it("lets the first call through immediately", async () => {
    installFakeClock();
    const limiter = createRateLimiter(10); // 100ms interval

    const start = performance.now();
    await limiter();
    expect(performance.now() - start).toBeLessThan(20);
  });

  it("spaces back-to-back calls by 1000/requestsPerSecond", async () => {
    const clock = installFakeClock();
    const limiter = createRateLimiter(10); // 100ms interval
    const waited: number[] = [];

    for (let i = 0; i < 3; i++) {
      const before = clock.now();
      await limiter();
      waited.push(clock.now() - before);
    }

    // First call: no wait. Second/third: each waits the full 100ms interval since calls happen
    // back-to-back with no real time passing between them on the fake clock.
    expect(waited).toEqual([0, 100, 100]);
  });

  it("doesn't wait if enough real time already passed between calls", async () => {
    const clock = installFakeClock();
    const limiter = createRateLimiter(10); // 100ms interval

    await limiter();
    clock.advance(150); // more than one interval's worth of "real" time passes
    const before = clock.now();
    await limiter();
    expect(clock.now() - before).toBe(0);
  });

  it("queues concurrent (not sequentially awaited) callers into consecutive slots", async () => {
    const clock = installFakeClock();
    const limiter = createRateLimiter(10); // 100ms interval

    // All three start "at once" (no sequential await between them) - each should still land in
    // its own slot, 100ms apart, rather than all going through immediately.
    await Promise.all([0, 1, 2].map(() => limiter()));

    expect(clock.now()).toBe(200); // slots at 0ms, 100ms, 200ms
  });

  it("enforces the rate independently across separate rate limiters", async () => {
    installFakeClock();
    const a = createRateLimiter(10);
    const b = createRateLimiter(10);

    const start = performance.now();
    await a();
    await b();
    // Two different limiter instances don't share state - both let their first call through
    // immediately.
    expect(performance.now() - start).toBeLessThan(20);
  });
});
