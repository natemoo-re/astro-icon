import { describe, expect, it, vi } from "vitest";
import { mergeSources } from "../src/content/compositeSource.js";
import type { IconSource } from "../src/content/source.js";
import type { IconEntry } from "../../typings/types";

function entryFor(id: string): IconEntry {
  return { body: id, viewBox: "0 0 24 24", width: 24, height: 24 };
}

function fakeSource(
  name: string,
  icons: Record<string, IconEntry>,
  listIcons: (() => Promise<string[]>) | null = () =>
    Promise.resolve(Object.keys(icons)),
): IconSource {
  const source: IconSource = {
    name,
    getIcon: vi.fn(async (iconName: string) => {
      const entry = icons[iconName];
      if (!entry) throw new Error(`"${name}" has no icon named "${iconName}"`);
      return entry;
    }),
  };
  if (listIcons) source.listIcons = listIcons;
  return source;
}

describe("mergeSources / single source", () => {
  it("passes a single source through unchanged, no wrapping", () => {
    const source = fakeSource("mdi", {});
    expect(mergeSources(source)).toBe(source);
  });

  it("passes a single-element array through as that source, unwrapped", () => {
    const source = fakeSource("mdi", {});
    expect(mergeSources([source])).toBe(source);
  });
});

describe("mergeSources / multiple sources / getIcon", () => {
  it("resolves an icon from whichever source has it", async () => {
    const mdi = fakeSource("mdi", { home: entryFor("mdi-home") });
    const ic = fakeSource("ic", { star: entryFor("ic-star") });
    const merged = mergeSources([mdi, ic]);

    await expect(merged.getIcon("home")).resolves.toEqual(entryFor("mdi-home"));
    await expect(merged.getIcon("star")).resolves.toEqual(entryFor("ic-star"));
  });

  it("prefers the first source's icon on a name collision", async () => {
    const first = fakeSource("first", { home: entryFor("first-home") });
    const second = fakeSource("second", { home: entryFor("second-home") });
    const merged = mergeSources([first, second]);

    await expect(merged.getIcon("home")).resolves.toEqual(
      entryFor("first-home"),
    );
    expect(second.getIcon).not.toHaveBeenCalled();
  });

  it("falls through to a later source when an earlier one doesn't have it", async () => {
    const mdi = fakeSource("mdi", { home: entryFor("mdi-home") });
    const ic = fakeSource("ic", { star: entryFor("ic-star") });
    const merged = mergeSources([mdi, ic]);

    await expect(merged.getIcon("star")).resolves.toEqual(entryFor("ic-star"));
  });

  it("throws a descriptive error when no source has the icon", async () => {
    const merged = mergeSources([fakeSource("mdi", {}), fakeSource("ic", {})]);
    await expect(merged.getIcon("missing")).rejects.toThrow(
      /mdi\+ic.*missing/s,
    );
  });
});

describe("mergeSources / multiple sources / per-source fallback logging", () => {
  it("debug-logs a per-source failure when falling back to the next source, on an eventual success", async () => {
    const mdi = fakeSource("mdi", {});
    const ic = fakeSource("ic", { star: entryFor("ic-star") });
    const debug = vi.fn();
    const merged = mergeSources([mdi, ic], { debug });

    await expect(merged.getIcon("star")).resolves.toEqual(entryFor("ic-star"));

    expect(debug).toHaveBeenCalledOnce();
    expect(debug).toHaveBeenCalledWith(
      expect.stringMatching(
        /"mdi" failed to resolve "star" \(.*\), falling back to the next source in "mdi\+ic"/,
      ),
    );
  });

  it("doesn't log the last source's failure - it's already in the thrown aggregate error", async () => {
    const mdi = fakeSource("mdi", {});
    const ic = fakeSource("ic", {});
    const debug = vi.fn();
    const merged = mergeSources([mdi, ic], { debug });

    await expect(merged.getIcon("missing")).rejects.toThrow();

    expect(debug).toHaveBeenCalledOnce();
    expect(debug).toHaveBeenCalledWith(expect.stringContaining('"mdi" failed'));
  });

  it("doesn't log anything when the first source resolves the icon directly", async () => {
    const mdi = fakeSource("mdi", { home: entryFor("mdi-home") });
    const ic = fakeSource("ic", {});
    const debug = vi.fn();
    const merged = mergeSources([mdi, ic], { debug });

    await merged.getIcon("home");

    expect(debug).not.toHaveBeenCalled();
  });
});

describe("mergeSources / multiple sources / checkPreconditions", () => {
  it("resolves as soon as one member's checkPreconditions() succeeds, without checking the rest", async () => {
    const broken: IconSource = {
      name: "broken",
      getIcon: vi.fn(),
      checkPreconditions: vi.fn(async () => {
        throw new Error("not installed");
      }),
    };
    const working: IconSource = {
      name: "working",
      getIcon: vi.fn(),
      checkPreconditions: vi.fn(async () => {}),
    };
    const untried: IconSource = {
      name: "untried",
      getIcon: vi.fn(),
      checkPreconditions: vi.fn(async () => {
        throw new Error("should never run");
      }),
    };
    const merged = mergeSources([broken, working, untried]);

    await expect(merged.checkPreconditions?.()).resolves.toBeUndefined();
    expect(untried.checkPreconditions).not.toHaveBeenCalled();
  });

  it("treats a member with no checkPreconditions() as trivially fine, without checking any member after it", async () => {
    const noCheck = fakeSource("noCheck", {}, null);
    const untried: IconSource = {
      name: "untried",
      getIcon: vi.fn(),
      checkPreconditions: vi.fn(async () => {
        throw new Error("should never run");
      }),
    };
    const merged = mergeSources([noCheck, untried]);

    await expect(merged.checkPreconditions?.()).resolves.toBeUndefined();
    expect(untried.checkPreconditions).not.toHaveBeenCalled();
  });

  it("throws an aggregate error only when every member's checkPreconditions() fails", async () => {
    const a: IconSource = {
      name: "a",
      getIcon: vi.fn(),
      checkPreconditions: vi.fn(async () => {
        throw new Error("a is broken");
      }),
    };
    const b: IconSource = {
      name: "b",
      getIcon: vi.fn(),
      checkPreconditions: vi.fn(async () => {
        throw new Error("b is broken");
      }),
    };
    const merged = mergeSources([a, b]);

    await expect(merged.checkPreconditions?.()).rejects.toThrow(
      /no source.*is usable/i,
    );
    await expect(merged.checkPreconditions?.()).rejects.toMatchObject({
      hint: expect.stringMatching(/a is broken/),
    });
    await expect(merged.checkPreconditions?.()).rejects.toMatchObject({
      hint: expect.stringMatching(/b is broken/),
    });
  });
});

describe("mergeSources / multiple sources / resolveRoot", () => {
  it("fans out to every member that implements it", () => {
    const a: IconSource = { name: "a", getIcon: vi.fn(), resolveRoot: vi.fn() };
    const b: IconSource = { name: "b", getIcon: vi.fn() };
    const merged = mergeSources([a, b]);
    const root = new URL("file:///some/project/");

    merged.resolveRoot?.(root);

    expect(a.resolveRoot).toHaveBeenCalledWith(root);
  });
});

describe("mergeSources / multiple sources / listIcons", () => {
  it("merges and dedupes names, first-source order wins", async () => {
    const first = fakeSource("first", { home: entryFor("a") });
    const second = fakeSource("second", {
      home: entryFor("b"),
      star: entryFor("c"),
    });
    const merged = mergeSources([first, second]);

    await expect(merged.listIcons?.()).resolves.toEqual(["home", "star"]);
  });

  it("treats a source that can't list itself (or fails to) as contributing nothing", async () => {
    const noList = fakeSource("mdi", { home: entryFor("a") }, null);
    const failing: IconSource = {
      name: "failing",
      getIcon: vi.fn(async () => entryFor("x")),
      listIcons: async () => {
        throw new Error("nope");
      },
    };
    const ic = fakeSource("ic", { star: entryFor("b") });
    const merged = mergeSources([noList, failing, ic]);

    await expect(merged.listIcons?.()).resolves.toEqual(["star"]);
  });
});

describe("mergeSources naming", () => {
  it("joins each source's name", () => {
    expect(
      mergeSources([fakeSource("mdi", {}), fakeSource("ic", {})]).name,
    ).toBe("mdi+ic");
  });
});

describe("mergeSources / per-source concurrency", () => {
  /** Resolves after a macrotask tick, so overlapping calls actually overlap instead of resolving synchronously. */
  function tick(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  function trackingSource(
    name: string,
    concurrency?: number,
  ): IconSource & { peak: number } {
    const tracker = {
      name,
      concurrency,
      peak: 0,
      concurrent: 0,
      async getIcon(iconName: string) {
        tracker.concurrent++;
        tracker.peak = Math.max(tracker.peak, tracker.concurrent);
        await tick();
        tracker.concurrent--;
        return entryFor(`${name}-${iconName}`);
      },
    };
    return tracker;
  }

  it("caps concurrent calls into a source at that source's own limit", async () => {
    const capped = trackingSource("capped", 2);
    // Two members forces the object-literal path rather than single-source pass-through, so the
    // gate is actually exercised.
    const composite = mergeSources([capped, fakeSource("fallback", {})]);

    await Promise.all(
      ["a", "b", "c", "d", "e", "f"].map((n) => composite.getIcon(n)),
    );
    expect(capped.peak).toBe(2);
  });

  it("doesn't throttle an uncapped source down to a capped sibling's limit", async () => {
    const uncapped = trackingSource("uncapped");
    const capped = trackingSource("capped", 1);
    // "uncapped" is tried first for every name, so every call resolves there and never reaches
    // "capped" - its own (absent) cap should govern, not the composite's other member.
    const composite = mergeSources([uncapped, capped]);

    await Promise.all(
      Array.from({ length: 6 }, (_, i) => composite.getIcon(`icon-${i}`)),
    );
    expect(uncapped.peak).toBe(6);
    expect(capped.peak).toBe(0);
  });
});
