import type { IconifyJSON } from "@iconify/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@iconify/utils/lib/loader/fs", () => ({
  loadCollectionFromFS: vi.fn(),
}));

// `iconify()` has no context/options seam to inject a typegen recorder through (unlike the
// loaders) - it's called directly in `content.config.ts`, before any loader exists. Mocking the
// module here is the seam, so this suite doesn't write real files under `.astro/`.
vi.mock("../src/content/typegen/index.js", () => ({
  recordCollection: vi.fn(async () => {}),
  recordCatalog: vi.fn(async () => {}),
}));

const pack: IconifyJSON = {
  prefix: "mdi",
  icons: {
    search: { body: "<path/>", width: 24, height: 24 },
    menu: { body: "<path/>", width: 24, height: 24 },
  },
  aliases: {
    find: { parent: "search" },
  },
};

// `pack.ts` (used internally by `iconify`) caches resolved packs in a module-level
// Map. Resetting the registry before each test - rather than exposing a test-only cache-clearing
// export - gets every test a fresh, empty cache.
let iconify: (typeof import("../src/content/iconify/iconify.js"))["iconify"];
let mockedLoadCollectionFromFS: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.resetModules();
  ({ iconify } = await import("../src/content/iconify/iconify.js"));
  const { loadCollectionFromFS } = await import("@iconify/utils/lib/loader/fs");
  mockedLoadCollectionFromFS = vi.mocked(loadCollectionFromFS);
  mockedLoadCollectionFromFS.mockReset();
});

describe("iconify naming", () => {
  it("namespaces the source name with the pack", () => {
    expect(iconify("mdi").name).toBe("iconify:mdi");
  });
});

describe("iconify / local pack", () => {
  it("resolves a single icon via getIcons", async () => {
    mockedLoadCollectionFromFS.mockResolvedValueOnce(pack);
    const source = iconify("mdi");

    const result = await source.getIcons(["search"]);

    expect(result.get("search")).toMatchObject({ viewBox: "0 0 24 24" });
  });

  it("resolves several icons from one getIcons call", async () => {
    mockedLoadCollectionFromFS.mockResolvedValueOnce(pack);
    const source = iconify("mdi");

    const result = await source.getIcons(["search", "menu"]);

    expect(result.get("search")).toMatchObject({ viewBox: "0 0 24 24" });
    expect(result.get("menu")).toMatchObject({ viewBox: "0 0 24 24" });
  });

  it("puts a descriptive Error in the map for an icon the pack doesn't have", async () => {
    mockedLoadCollectionFromFS.mockResolvedValueOnce(pack);
    const source = iconify("mdi");

    const result = await source.getIcons(["does-not-exist"]);

    expect(result.get("does-not-exist")).toBeInstanceOf(Error);
    expect((result.get("does-not-exist") as Error).message).toMatch(/mdi/);
  });

  it("lists icon and alias names via listIcons", async () => {
    mockedLoadCollectionFromFS.mockResolvedValueOnce(pack);
    const source = iconify("mdi");

    const names = await source.listIcons?.();

    expect(names).toEqual(["search", "menu", "find"]);
  });

  it("only resolves the local pack once across getIcons/listIcons calls", async () => {
    mockedLoadCollectionFromFS.mockResolvedValueOnce(pack);
    const source = iconify("mdi");

    await source.getIcons(["search"]);
    await source.listIcons?.();
    await source.getIcons(["menu"]);

    expect(mockedLoadCollectionFromFS).toHaveBeenCalledOnce();
  });
});

describe("iconify / transform", () => {
  const strokePack: IconifyJSON = {
    prefix: "tabler",
    icons: {
      search: {
        body: '<path stroke-width="2" d="M10 10h4v4h-4z"/>',
        width: 24,
        height: 24,
      },
    },
  };

  it("applies transform to the built entry, last, before it's returned", async () => {
    mockedLoadCollectionFromFS.mockResolvedValueOnce(strokePack);
    const source = iconify("tabler", {
      transform: (entry) => ({
        ...entry,
        body: entry.body.replaceAll('stroke-width="2"', 'stroke-width="1.5"'),
      }),
    });

    const result = await source.getIcons(["search"]);

    expect((result.get("search") as { body: string }).body).toContain(
      'stroke-width="1.5"',
    );
  });

  it("passes the built entry and { collection, name } context to transform", async () => {
    mockedLoadCollectionFromFS.mockResolvedValueOnce(strokePack);
    const transform = vi.fn((entry) => entry);
    const source = iconify("tabler", { transform });

    await source.getIcons(["search"]);

    expect(transform).toHaveBeenCalledWith(
      expect.objectContaining({ viewBox: "0 0 24 24" }),
      { collection: "tabler", name: "search" },
    );
  });

  it("supports an async transform", async () => {
    mockedLoadCollectionFromFS.mockResolvedValueOnce(strokePack);
    const source = iconify("tabler", {
      transform: async (entry) => ({ ...entry, title: "Search" }),
    });

    const result = await source.getIcons(["search"]);

    expect(result.get("search")).toMatchObject({ title: "Search" });
  });
});

describe("iconify / not installed", () => {
  // A pack name that doesn't actually exist anywhere on disk - unlike "mdi" (installed for
  // other tests in this suite), so the `require.resolve` fallback (#263) can't find it either
  // and these still exercise the "genuinely not installed" path.
  const notInstalled = "definitely-not-a-real-iconify-pack-xyz";

  it("resolves undefined (never crashes) from getVersion for a pack that isn't installed", async () => {
    const source = iconify(notInstalled);

    await expect(source.getVersion?.()).resolves.toBeUndefined();
  });

  // getIcons/listIcons no longer independently guard "pack isn't installed" - only
  // checkPreconditions() does (see "iconify / checkPreconditions" below). Real usage
  // through createIconLoader/createLiveIconLoader always calls checkPreconditions() first, so
  // getIcons/listIcons trust it already ran; calling either directly, first, without it, is
  // unsupported and surfaces whatever low-level failure the missing data happens to cause instead
  // of a descriptive AstroIconError - either a rejected getIcons() call, or a per-name Error in
  // its result map, but never that specific "isn't installed locally" message either way.
  it("doesn't produce a descriptive error from getIcons/listIcons on their own, without checkPreconditions() run first", async () => {
    mockedLoadCollectionFromFS.mockResolvedValueOnce(undefined);
    const source = iconify(notInstalled);

    try {
      const result = await source.getIcons(["search"]);
      const entry = result.get("search");
      if (entry instanceof Error) {
        expect(entry.message).not.toMatch(/isn't installed locally/i);
      }
    } catch (ex) {
      expect((ex as Error).message).not.toMatch(/isn't installed locally/i);
    }
  });
});

describe("iconify / icons allowlist", () => {
  // The pack load now starts eagerly at construction regardless of the allowlist (see "fails
  // eagerly" below), so these no longer assert the pack is never touched - only that neither
  // check *waits* on that load, by leaving it permanently unresolved.
  it("puts a per-name Error in the map for a name not in the allowlist, without waiting on the pack load", async () => {
    mockedLoadCollectionFromFS.mockReturnValueOnce(new Promise(() => {}));
    const source = iconify("mdi", { allowed: ["search"] });

    const result = await source.getIcons(["menu"]);

    expect(result.get("menu")).toBeInstanceOf(Error);
    expect((result.get("menu") as Error).message).toMatch(/isn't in the allowed/i);
  });

  it("resolves an allowed name normally", async () => {
    mockedLoadCollectionFromFS.mockResolvedValueOnce(pack);
    const source = iconify("mdi", { allowed: ["search"] });

    const result = await source.getIcons(["search"]);

    expect(result.get("search")).toMatchObject({ viewBox: "0 0 24 24" });
  });

  it("types exactly the given allowlist, without waiting on the pack load", async () => {
    mockedLoadCollectionFromFS.mockReturnValueOnce(new Promise(() => {}));
    const source = iconify("mdi", {
      allowed: ["search", "not-real"],
    });

    await expect(source.listIcons?.()).resolves.toEqual(["search", "not-real"]);
  });
});

describe("iconify / checkPreconditions", () => {
  // Regression: before checkPreconditions() existed, a missing pack only ever surfaced from
  // individual getIcon calls during a build - listIcons() returned an allowed allowlist without
  // ever checking, and in dev each getIcon failure is just warned-and-skipped, burying "the whole
  // pack is missing" as N separate per-icon warnings instead of one clear failure.
  // createIconLoader/createLiveIconLoader both call checkPreconditions() before anything else
  // specifically to catch this.
  it("throws when the pack isn't installed, even with an allowlist set", async () => {
    mockedLoadCollectionFromFS.mockResolvedValueOnce(undefined);
    // A pack name that doesn't exist anywhere on disk (unlike "mdi", genuinely installed for
    // other tests in this suite) so the require.resolve fallback (#263) can't find it either -
    // otherwise this would pass for the wrong reason even without the fix under test.
    const source = iconify(
      "definitely-not-a-real-iconify-pack-xyz",
      { allowed: ["search"] },
    );

    await expect(source.checkPreconditions?.()).rejects.toThrow(
      /isn't installed/i,
    );
  });

  it("resolves once the pack load confirms the pack is installed", async () => {
    mockedLoadCollectionFromFS.mockResolvedValueOnce(pack);
    const source = iconify("mdi");

    await expect(source.checkPreconditions?.()).resolves.toBeUndefined();
  });
});

describe("iconify / pack cache sharing", () => {
  it("shares a resolved local pack across separate iconify() instances", async () => {
    mockedLoadCollectionFromFS.mockResolvedValueOnce(pack);

    await iconify("mdi").getIcons(["search"]);
    await iconify("mdi").getIcons(["menu"]);

    expect(mockedLoadCollectionFromFS).toHaveBeenCalledOnce();
  });
});

describe("iconify / fails eagerly", () => {
  it("starts resolving the local pack as soon as the source is constructed, not on first getIcons/listIcons", () => {
    mockedLoadCollectionFromFS.mockResolvedValueOnce(pack);

    iconify("mdi");

    // No getIcons()/listIcons() call above - the pack load already started regardless.
    expect(mockedLoadCollectionFromFS).toHaveBeenCalledOnce();
  });
});

describe("iconify / resolveRoot", () => {
  it("resolves the eager pack load against process.cwd() until resolveRoot anchors it elsewhere", () => {
    mockedLoadCollectionFromFS.mockResolvedValueOnce(pack);

    iconify("mdi");

    expect(mockedLoadCollectionFromFS).toHaveBeenCalledWith(
      "mdi",
      undefined,
      undefined,
      process.cwd(),
    );
  });

  it("restarts the pack load against the anchored root when resolveRoot differs from process.cwd()", () => {
    mockedLoadCollectionFromFS
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(pack);

    const source = iconify("mdi");
    source.resolveRoot?.(new URL("file:///some/other/project/"));

    expect(mockedLoadCollectionFromFS).toHaveBeenCalledTimes(2);
    expect(mockedLoadCollectionFromFS).toHaveBeenNthCalledWith(
      2,
      "mdi",
      undefined,
      undefined,
      "/some/other/project",
    );
  });

  it("doesn't restart the pack load when resolveRoot matches process.cwd()", () => {
    mockedLoadCollectionFromFS.mockResolvedValueOnce(pack);

    const source = iconify("mdi");
    source.resolveRoot?.(new URL(`file://${process.cwd()}/`));

    expect(mockedLoadCollectionFromFS).toHaveBeenCalledOnce();
  });
});
