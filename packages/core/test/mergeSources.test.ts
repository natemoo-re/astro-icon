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
  listIcons: (() => Promise<string[]>) | null = () => Promise.resolve(Object.keys(icons)),
): IconSource {
  return {
    name,
    getIcon: vi.fn(async (iconName: string) => {
      const entry = icons[iconName];
      if (!entry) throw new Error(`"${name}" has no icon named "${iconName}"`);
      return entry;
    }),
    ...(listIcons ? { listIcons } : {}),
  };
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

    await expect(merged.getIcon("home")).resolves.toEqual(entryFor("first-home"));
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
    await expect(merged.getIcon("missing")).rejects.toThrow(/mdi\+ic.*missing/s);
  });
});

describe("mergeSources / multiple sources / listIcons", () => {
  it("merges and dedupes names, first-source order wins", async () => {
    const first = fakeSource("first", { home: entryFor("a") });
    const second = fakeSource("second", { home: entryFor("b"), star: entryFor("c") });
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
    expect(mergeSources([fakeSource("mdi", {}), fakeSource("ic", {})]).name).toBe("mdi+ic");
  });
});
