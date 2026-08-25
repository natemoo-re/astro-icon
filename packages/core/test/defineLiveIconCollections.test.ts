import { describe, expect, it, vi } from "vitest";
import { defineLiveIconCollections } from "../src/content/defineLiveIconCollections.js";
import { recordCollection } from "../src/content/typegen/index.js";
import type { IconEntry } from "../../typings/types";
import type { IconSource } from "../src/content/source.js";

vi.mock("../src/content/typegen/index.js", () => ({
  recordCollection: vi.fn(async () => {}),
  recordCatalog: vi.fn(async () => {}),
}));

const mockedRecordCollection = vi.mocked(recordCollection);

const entry: IconEntry = {
  body: "<path/>",
  viewBox: "0 0 24 24",
  width: 24,
  height: 24,
};

function fakeSource(name: string): IconSource {
  return {
    name,
    getIcons: vi.fn(async (names: string[]) => new Map(names.map((n) => [n, entry]))),
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
