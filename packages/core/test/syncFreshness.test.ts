import { describe, expect, it, vi } from "vitest";
import { isUpToDate, recordVersionKey } from "../src/content/syncFreshness.js";

function fakeMeta(initial: Record<string, string> = {}) {
  const stored = new Map(Object.entries(initial));
  return {
    get: (key: string) => stored.get(key),
    set: vi.fn((key: string, value: string) => stored.set(key, value)),
    delete: vi.fn((key: string) => stored.delete(key)),
  };
}

function fakeStore(present: string[]) {
  const has = new Set(present);
  return { has: (name: string) => has.has(name) };
}

describe("isUpToDate", () => {
  it("is false when versionKey is undefined - no reliable freshness signal", () => {
    const meta = fakeMeta({ v: "abc" });
    expect(isUpToDate(undefined, "v", meta, ["a"], fakeStore(["a"]))).toBe(
      false,
    );
  });

  it("is false when versionKey doesn't match the recorded one", () => {
    const meta = fakeMeta({ v: "old" });
    expect(isUpToDate("new", "v", meta, ["a"], fakeStore(["a"]))).toBe(false);
  });

  it("is false when a name is missing from the store even if the version matches", () => {
    const meta = fakeMeta({ v: "abc" });
    expect(isUpToDate("abc", "v", meta, ["a", "b"], fakeStore(["a"]))).toBe(
      false,
    );
  });

  it("is true when versionKey matches and every name is present", () => {
    const meta = fakeMeta({ v: "abc" });
    expect(
      isUpToDate("abc", "v", meta, ["a", "b"], fakeStore(["a", "b"])),
    ).toBe(true);
  });
});

describe("recordVersionKey", () => {
  it("sets the key when versionKey is defined", () => {
    const meta = fakeMeta();
    recordVersionKey(meta, "v", "abc");
    expect(meta.set).toHaveBeenCalledWith("v", "abc");
    expect(meta.delete).not.toHaveBeenCalled();
  });

  it("deletes the key when versionKey is undefined", () => {
    const meta = fakeMeta({ v: "abc" });
    recordVersionKey(meta, "v", undefined);
    expect(meta.delete).toHaveBeenCalledWith("v");
    expect(meta.set).not.toHaveBeenCalled();
  });
});
