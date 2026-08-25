import { describe, expect, it, vi } from "vitest";
import { defineLiveIconCollections as realDefineLiveIconCollections } from "../src/content/defineLiveIconCollections.js";
import type { IconEntry } from "../../typings/types";
import type { IconSource } from "../src/content/source.js";

// Substituted through the (undocumented, test-only) second `options` argument, instead of
// mocking the whole typegen module - keeps this suite from writing real files under `.astro/`.
const mockedRecordCollection = vi.fn(async () => {});

function defineLiveIconCollections<
  T extends Record<string, IconSource | IconSource[]>,
>(sources: T) {
  return realDefineLiveIconCollections(sources, {
    typegen: { recordCollection: mockedRecordCollection },
  });
}

const entry: IconEntry = {
  body: "<path/>",
  viewBox: "0 0 24 24",
  width: 24,
  height: 24,
};

function fakeSource(name: string): IconSource {
  return {
    name,
    getIcons: vi.fn(
      async (names: string[]) => new Map(names.map((n) => [n, entry])),
    ),
  };
}

describe("defineLiveIconCollections", () => {
  it("produces one defineLiveCollection()-shaped entry per key", async () => {
    const collections = defineLiveIconCollections({
      spinners: fakeSource("iconify:svg-spinners"),
      brands: [fakeSource("iconify:simple-icons"), fakeSource("local")],
    });

    expect(Object.keys(collections)).toEqual(["spinners", "brands"]);
    expect(collections.spinners.type).toBe("live");
    expect(collections.spinners.loader.name).toBe(
      "astro-icon/collections/iconify:svg-spinners",
    );

    const result = await collections.spinners.loader.loadEntry({
      filter: { id: "dots" },
      collection: "spinners",
    });
    expect(result).toEqual({ id: "dots", data: entry });
  });

  it("uses each object key as the loader's collection key for typegen", async () => {
    mockedRecordCollection.mockClear();

    defineLiveIconCollections({ spinners: fakeSource("iconify:svg-spinners") });
    await Promise.resolve();

    expect(mockedRecordCollection).toHaveBeenCalledWith(
      expect.any(URL),
      "live",
      "spinners",
      [],
    );
  });
});
