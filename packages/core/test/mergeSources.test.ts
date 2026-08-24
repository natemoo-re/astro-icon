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
    getIcons: vi.fn(async (names: string[]) => {
      return new Map<string, IconEntry | Error>(
        names.map((iconName) => [
          iconName,
          icons[iconName] ??
            new Error(`"${name}" has no icon named "${iconName}"`),
        ]),
      );
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

describe("mergeSources / multiple sources / getIcons", () => {
  it("resolves each icon from whichever source has it", async () => {
    const mdi = fakeSource("mdi", { home: entryFor("mdi-home") });
    const ic = fakeSource("ic", { star: entryFor("ic-star") });
    const merged = mergeSources([mdi, ic]);

    const result = await merged.getIcons(["home", "star"]);

    expect(result.get("home")).toEqual(entryFor("mdi-home"));
    expect(result.get("star")).toEqual(entryFor("ic-star"));
  });

  it("prefers the first source's icon on a name collision", async () => {
    const first = fakeSource("first", { home: entryFor("first-home") });
    const second = fakeSource("second", { home: entryFor("second-home") });
    const merged = mergeSources([first, second]);

    const result = await merged.getIcons(["home"]);

    expect(result.get("home")).toEqual(entryFor("first-home"));
    expect(second.getIcons).not.toHaveBeenCalled();
  });

  it("only asks a later source about names the earlier one(s) didn't resolve", async () => {
    const mdi = fakeSource("mdi", { home: entryFor("mdi-home") });
    const ic = fakeSource("ic", { star: entryFor("ic-star") });
    const merged = mergeSources([mdi, ic]);

    const result = await merged.getIcons(["home", "star"]);

    expect(result.get("star")).toEqual(entryFor("ic-star"));
    // "home" already resolved from mdi - ic is only asked about "star".
    expect(ic.getIcons).toHaveBeenCalledWith(["star"]);
  });

  it("puts a descriptive Error in the map when no source has the icon", async () => {
    const merged = mergeSources([fakeSource("mdi", {}), fakeSource("ic", {})]);

    const result = await merged.getIcons(["missing"]);

    expect(result.get("missing")).toBeInstanceOf(Error);
    expect((result.get("missing") as Error).message).toMatch(/mdi\+ic.*missing/s);
  });

  it("resolves what it can and reports an Error for the rest, in one call", async () => {
    const mdi = fakeSource("mdi", { home: entryFor("mdi-home") });
    const ic = fakeSource("ic", {});
    const merged = mergeSources([mdi, ic]);

    const result = await merged.getIcons(["home", "missing"]);

    expect(result.get("home")).toEqual(entryFor("mdi-home"));
    expect(result.get("missing")).toBeInstanceOf(Error);
  });
});

describe("mergeSources / multiple sources / per-source fallback logging", () => {
  it("debug-logs a per-name failure when falling back to the next source, on an eventual success", async () => {
    const mdi = fakeSource("mdi", {});
    const ic = fakeSource("ic", { star: entryFor("ic-star") });
    const debug = vi.fn();
    const merged = mergeSources([mdi, ic], { debug, warn: vi.fn() });

    const result = await merged.getIcons(["star"]);

    expect(result.get("star")).toEqual(entryFor("ic-star"));
    expect(debug).toHaveBeenCalledOnce();
    expect(debug).toHaveBeenCalledWith(
      expect.stringMatching(
        /"mdi" failed to resolve "star" \(.*\), falling back to the next source in "mdi\+ic"/,
      ),
    );
  });

  it("doesn't log the last source's failure - it's already in the aggregate Error", async () => {
    const mdi = fakeSource("mdi", {});
    const ic = fakeSource("ic", {});
    const debug = vi.fn();
    const merged = mergeSources([mdi, ic], { debug, warn: vi.fn() });

    await merged.getIcons(["missing"]);

    expect(debug).toHaveBeenCalledOnce();
    expect(debug).toHaveBeenCalledWith(expect.stringContaining('"mdi" failed'));
  });

  it("doesn't log anything when the first source resolves the icon directly", async () => {
    const mdi = fakeSource("mdi", { home: entryFor("mdi-home") });
    const ic = fakeSource("ic", {});
    const debug = vi.fn();
    const merged = mergeSources([mdi, ic], { debug, warn: vi.fn() });

    await merged.getIcons(["home"]);

    expect(debug).not.toHaveBeenCalled();
  });
});

describe("mergeSources / multiple sources / checkPreconditions", () => {
  it("checks every member, resolving when at least one is usable and warning about each failure", async () => {
    const broken: IconSource = {
      name: "broken",
      getIcons: vi.fn(),
      checkPreconditions: vi.fn(async () => {
        throw new Error("not installed");
      }),
    };
    const working: IconSource = {
      name: "working",
      getIcons: vi.fn(),
      checkPreconditions: vi.fn(async () => {}),
    };
    const alsoBroken: IconSource = {
      name: "also-broken",
      getIcons: vi.fn(),
      checkPreconditions: vi.fn(async () => {
        throw new Error("misconfigured");
      }),
    };
    const warn = vi.fn();
    const merged = mergeSources([broken, working, alsoBroken], {
      debug: vi.fn(),
      warn,
    });

    await expect(merged.checkPreconditions?.()).resolves.toBeUndefined();
    expect(alsoBroken.checkPreconditions).toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("broken: not installed"),
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("also-broken: misconfigured"),
    );
  });

  it("treats a member with no checkPreconditions() as usable, still checking the members after it", async () => {
    const noCheck = fakeSource("noCheck", {}, null);
    const broken: IconSource = {
      name: "broken",
      getIcons: vi.fn(),
      checkPreconditions: vi.fn(async () => {
        throw new Error("not installed");
      }),
    };
    const warn = vi.fn();
    const merged = mergeSources([noCheck, broken], { debug: vi.fn(), warn });

    await expect(merged.checkPreconditions?.()).resolves.toBeUndefined();
    expect(broken.checkPreconditions).toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("broken: not installed"),
    );
  });

  it("throws an aggregate error only when every member's checkPreconditions() fails", async () => {
    const a: IconSource = {
      name: "a",
      getIcons: vi.fn(),
      checkPreconditions: vi.fn(async () => {
        throw new Error("a is broken");
      }),
    };
    const b: IconSource = {
      name: "b",
      getIcons: vi.fn(),
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
    const a: IconSource = {
      name: "a",
      getIcons: vi.fn(),
      resolveRoot: vi.fn(),
    };
    const b: IconSource = { name: "b", getIcons: vi.fn() };
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
      getIcons: vi.fn(async () => new Map([["x", entryFor("x")]])),
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

describe("mergeSources / batching across members", () => {
  it("gives the first member the whole names list in one call, not one call per name", async () => {
    const mdi = fakeSource("mdi", {
      home: entryFor("mdi-home"),
      star: entryFor("mdi-star"),
    });
    const merged = mergeSources([mdi, fakeSource("fallback", {})]);

    await merged.getIcons(["home", "star"]);

    expect(mdi.getIcons).toHaveBeenCalledOnce();
    expect(mdi.getIcons).toHaveBeenCalledWith(["home", "star"]);
  });

  it("narrows the batch to only the unresolved names on each subsequent member", async () => {
    const mdi = fakeSource("mdi", { home: entryFor("mdi-home") });
    const ic = fakeSource("ic", { star: entryFor("ic-star") });
    const merged = mergeSources([mdi, ic]);

    await merged.getIcons(["home", "star", "missing"]);

    expect(mdi.getIcons).toHaveBeenCalledWith(["home", "star", "missing"]);
    // Only "star" and "missing" carry over - "home" already resolved from mdi.
    expect(ic.getIcons).toHaveBeenCalledWith(["star", "missing"]);
  });
});
