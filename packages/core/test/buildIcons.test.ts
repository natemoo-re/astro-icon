import { describe, expect, it, vi } from "vitest";
import { buildIcon, buildIcons } from "../src/content/buildIcons.js";
import type { IconEntry } from "../../typings/types";

function entryFor(name: string): IconEntry {
  return {
    body: `<path d="${name}"/>`,
    viewBox: "0 0 24 24",
    width: 24,
    height: 24,
  };
}

describe("buildIcons", () => {
  it("calls source.getIcons once with the whole batch", async () => {
    const getIcons = vi.fn(async (names: string[]) => {
      return new Map(names.map((name) => [name, entryFor(name)]));
    });
    const source = { name: "test", getIcons };

    const built = await buildIcons(source, ["a", "b", "c", "d"], () => {});

    expect(getIcons).toHaveBeenCalledOnce();
    expect(getIcons).toHaveBeenCalledWith(["a", "b", "c", "d"]);
    expect(built.map((b) => b.name)).toEqual(["a", "b", "c", "d"]);
  });

  it("accepts a single name as a batch of one", async () => {
    const getIcons = vi.fn(async (names: string[]) => {
      return new Map(names.map((name) => [name, entryFor(name)]));
    });
    const source = { name: "test", getIcons };

    const built = await buildIcons(source, "a", () => {});

    expect(getIcons).toHaveBeenCalledWith(["a"]);
    expect(built.map((b) => b.name)).toEqual(["a"]);
  });

  it("returns an empty array for an empty batch without calling getIcons", async () => {
    const getIcons = vi.fn();
    const source = { name: "test", getIcons };

    const built = await buildIcons(source, [], () => {});

    expect(built).toEqual([]);
    expect(getIcons).not.toHaveBeenCalled();
  });

  it("reports a per-name Error via onError, without dropping the rest of the batch", async () => {
    const source = {
      name: "test",
      async getIcons(names: string[]) {
        return new Map(
          names.map((name) => [
            name,
            name === "bad" ? new Error("nope") : entryFor(name),
          ]),
        );
      },
    };
    const onError = vi.fn();

    const built = await buildIcons(source, ["a", "bad", "c"], onError);

    expect(built.map((b) => b.name)).toEqual(["a", "c"]);
    expect(onError).toHaveBeenCalledWith("bad", expect.any(Error));
  });

  it("reports every name via onError when getIcons rejects outright", async () => {
    const source = {
      name: "test",
      async getIcons(): Promise<never> {
        throw new Error("network down");
      },
    };
    const onError = vi.fn();

    const built = await buildIcons(source, ["a", "b"], onError);

    expect(built).toEqual([]);
    expect(onError).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledWith("a", expect.any(Error));
    expect(onError).toHaveBeenCalledWith("b", expect.any(Error));
  });

  it("reports a name missing from the returned map via onError", async () => {
    const source = {
      name: "test",
      async getIcons(names: string[]) {
        return new Map(
          names.filter((n) => n !== "missing").map((n) => [n, entryFor(n)]),
        );
      },
    };
    const onError = vi.fn();

    const built = await buildIcons(source, ["a", "missing"], onError);

    expect(built.map((b) => b.name)).toEqual(["a"]);
    expect(onError).toHaveBeenCalledWith("missing", expect.any(Error));
  });

  it("sanitizes every built icon's body", async () => {
    const source = {
      name: "test",
      async getIcons(names: string[]) {
        return new Map(
          names.map((name) => [
            name,
            {
              body: "<path/><script>alert(1)</script>",
              viewBox: "0 0 24 24",
              width: 24,
              height: 24,
            },
          ]),
        );
      },
    };

    const [built] = await buildIcons(source, ["a"], () => {});

    expect(built.data.body).toBe("<path />");
  });
});

describe("buildIcon", () => {
  it("returns the built icon on success", async () => {
    const source = {
      name: "test",
      async getIcons(names: string[]) {
        return new Map(names.map((name) => [name, entryFor(name)]));
      },
    };

    const built = await buildIcon(source, "a");

    expect(built.name).toBe("a");
  });

  it("throws the underlying cause when the name resolves to an Error", async () => {
    const cause = new Error("nope");
    const source = {
      name: "test",
      async getIcons() {
        return new Map([["bad", cause]]);
      },
    };

    await expect(buildIcon(source, "bad")).rejects.toBe(cause);
  });

  it("throws when getIcons rejects outright", async () => {
    const source = {
      name: "test",
      async getIcons(): Promise<never> {
        throw new Error("network down");
      },
    };

    await expect(buildIcon(source, "a")).rejects.toThrow("network down");
  });
});
