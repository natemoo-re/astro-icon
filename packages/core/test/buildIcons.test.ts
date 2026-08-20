import { describe, expect, it, vi } from "vitest";
import { buildIcons } from "../src/content/buildIcons.js";
import type { IconEntry } from "../../typings/types";

function entryFor(name: string): IconEntry {
  return {
    body: `<path d="${name}"/>`,
    viewBox: "0 0 24 24",
    width: 24,
    height: 24,
  };
}

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("buildIcons / concurrency", () => {
  it("resolves every name at once when the source sets no concurrency", async () => {
    let concurrent = 0;
    let peak = 0;
    const source = {
      async getIcon(name: string) {
        concurrent++;
        peak = Math.max(peak, concurrent);
        await tick();
        concurrent--;
        return entryFor(name);
      },
    };

    const built = await buildIcons(source, ["a", "b", "c", "d"], () => {});

    expect(peak).toBe(4);
    expect(built.map((b) => b.name)).toEqual(["a", "b", "c", "d"]);
  });

  it("respects the source's concurrency cap", async () => {
    let concurrent = 0;
    let peak = 0;
    const source = {
      concurrency: 2,
      async getIcon(name: string) {
        concurrent++;
        peak = Math.max(peak, concurrent);
        await tick();
        concurrent--;
        return entryFor(name);
      },
    };

    const built = await buildIcons(source, ["a", "b", "c", "d", "e"], () => {});

    expect(peak).toBe(2);
    expect(built).toHaveLength(5);
  });

  it("still reports a per-icon failure via onError under a concurrency cap, without dropping the others", async () => {
    const source = {
      concurrency: 2,
      async getIcon(name: string) {
        if (name === "bad") throw new Error("nope");
        return entryFor(name);
      },
    };
    const onError = vi.fn();

    const built = await buildIcons(source, ["a", "bad", "c"], onError);

    expect(built.map((b) => b.name)).toEqual(["a", "c"]);
    expect(onError).toHaveBeenCalledWith("bad", expect.any(Error));
  });

  it("sanitizes every built icon's body regardless of concurrency", async () => {
    const source = {
      concurrency: 1,
      async getIcon() {
        return {
          body: "<path/><script>alert(1)</script>",
          viewBox: "0 0 24 24",
          width: 24,
          height: 24,
        };
      },
    };

    const [built] = await buildIcons(source, ["a"], () => {});

    expect(built.data.body).toBe("<path />");
  });
});
