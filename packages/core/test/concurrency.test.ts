import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "../src/content/concurrency.js";

/** Resolves after a macrotask tick, so overlapping calls actually overlap instead of resolving synchronously. */
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("mapWithConcurrency", () => {
  it("preserves result order regardless of completion order", async () => {
    const delays = [30, 10, 20];
    const results = await mapWithConcurrency(
      delays,
      undefined,
      (ms) => new Promise((resolve) => setTimeout(() => resolve(ms), ms)),
    );
    expect(results).toEqual([30, 10, 20]);
  });

  it("passes both the item and its index to worker", async () => {
    const seen: Array<[string, number]> = [];
    await mapWithConcurrency(["a", "b", "c"], undefined, async (item, i) => {
      seen.push([item, i]);
    });
    expect(seen).toEqual([
      ["a", 0],
      ["b", 1],
      ["c", 2],
    ]);
  });

  it("runs every item at once when limit is omitted", async () => {
    let concurrent = 0;
    let peak = 0;
    await mapWithConcurrency(
      Array.from({ length: 10 }),
      undefined,
      async () => {
        concurrent++;
        peak = Math.max(peak, concurrent);
        await tick();
        concurrent--;
      },
    );
    expect(peak).toBe(10);
  });

  it("never exceeds the given concurrency limit", async () => {
    let concurrent = 0;
    let peak = 0;
    await mapWithConcurrency(Array.from({ length: 20 }), 3, async () => {
      concurrent++;
      peak = Math.max(peak, concurrent);
      await tick();
      concurrent--;
    });
    expect(peak).toBe(3);
  });

  it("still runs every item when the limit exceeds the item count", async () => {
    let concurrent = 0;
    let peak = 0;
    await mapWithConcurrency(Array.from({ length: 3 }), 100, async () => {
      concurrent++;
      peak = Math.max(peak, concurrent);
      await tick();
      concurrent--;
    });
    expect(peak).toBe(3);
  });

  it("resolves to an empty array for an empty input without calling worker", async () => {
    let calls = 0;
    const results = await mapWithConcurrency([], 5, async () => {
      calls++;
    });
    expect(results).toEqual([]);
    expect(calls).toBe(0);
  });

  it("propagates a worker rejection", async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error("boom");
        return n;
      }),
    ).rejects.toThrow("boom");
  });
});
