import type { IconifyJSON } from "@iconify/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@iconify/utils/lib/loader/fs", () => ({
  loadCollectionFromFS: vi.fn(),
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

// `pack.ts` (used internally by `iconifyLocalSource`) caches resolved packs in a module-level
// Map. Resetting the registry before each test - rather than exposing a test-only cache-clearing
// export - gets every test a fresh, empty cache.
let iconifyLocalSource: (typeof import("../src/content/iconify/source.js"))["iconifyLocalSource"];
let mockedLoadCollectionFromFS: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.resetModules();
  ({ iconifyLocalSource } = await import("../src/content/iconify/source.js"));
  const { loadCollectionFromFS } = await import("@iconify/utils/lib/loader/fs");
  mockedLoadCollectionFromFS = vi.mocked(loadCollectionFromFS);
  mockedLoadCollectionFromFS.mockReset();
});

describe("iconifyLocalSource naming", () => {
  it("namespaces the source name with the pack", () => {
    expect(iconifyLocalSource("mdi").name).toBe("iconify-local:mdi");
  });
});

describe("iconifyLocalSource / local pack", () => {
  it("resolves a single icon via getIcon", async () => {
    mockedLoadCollectionFromFS.mockResolvedValueOnce(pack);
    const source = iconifyLocalSource("mdi");

    const entry = await source.getIcon("search");

    expect(entry.viewBox).toBe("0 0 24 24");
  });

  it("throws for an icon the pack doesn't have", async () => {
    mockedLoadCollectionFromFS.mockResolvedValueOnce(pack);
    const source = iconifyLocalSource("mdi");

    await expect(source.getIcon("does-not-exist")).rejects.toThrow(/mdi/);
  });

  it("lists icon and alias names via listIcons", async () => {
    mockedLoadCollectionFromFS.mockResolvedValueOnce(pack);
    const source = iconifyLocalSource("mdi");

    const names = await source.listIcons?.();

    expect(names).toEqual(["search", "menu", "find"]);
  });

  it("only resolves the local pack once across getIcon/listIcons calls", async () => {
    mockedLoadCollectionFromFS.mockResolvedValueOnce(pack);
    const source = iconifyLocalSource("mdi");

    await source.getIcon("search");
    await source.listIcons?.();
    await source.getIcon("menu");

    expect(mockedLoadCollectionFromFS).toHaveBeenCalledOnce();
  });
});

describe("iconifyLocalSource / not installed", () => {
  // A pack name that doesn't actually exist anywhere on disk - unlike "mdi" (installed for
  // other tests in this suite), so the `require.resolve` fallback (#263) can't find it either
  // and these still exercise the "genuinely not installed" path.
  const notInstalled = "definitely-not-a-real-iconify-pack-xyz";

  it("throws from getIcon instead of falling back to the API", async () => {
    mockedLoadCollectionFromFS.mockResolvedValueOnce(undefined);
    const source = iconifyLocalSource(notInstalled);

    await expect(source.getIcon("search")).rejects.toThrow(
      /isn't installed locally/i,
    );
  });

  it("throws from listIcons instead of falling back to the API", async () => {
    mockedLoadCollectionFromFS.mockResolvedValueOnce(undefined);
    const source = iconifyLocalSource(notInstalled);

    await expect(source.listIcons?.()).rejects.toThrow(
      /isn't installed locally/i,
    );
  });

  it("resolves undefined (never crashes) from getVersion for a pack that isn't installed", async () => {
    const source = iconifyLocalSource(notInstalled);

    await expect(source.getVersion?.()).resolves.toBeUndefined();
  });
});

describe("iconifyLocalSource / icons allowlist", () => {
  // The pack load now starts eagerly at construction regardless of the allowlist (see "fails
  // eagerly" below), so these no longer assert the pack is never touched - only that neither
  // check *waits* on that load, by leaving it permanently unresolved.
  it("rejects a name not in the allowlist without waiting on the pack load", async () => {
    mockedLoadCollectionFromFS.mockReturnValueOnce(new Promise(() => {}));
    const source = iconifyLocalSource("mdi", { allowed: ["search"] });

    await expect(source.getIcon("menu")).rejects.toThrow(
      /isn't in the allowed/i,
    );
  });

  it("resolves an allowed name normally", async () => {
    mockedLoadCollectionFromFS.mockResolvedValueOnce(pack);
    const source = iconifyLocalSource("mdi", { allowed: ["search"] });

    await expect(source.getIcon("search")).resolves.toMatchObject({
      viewBox: "0 0 24 24",
    });
  });

  it("types exactly the given allowlist, without waiting on the pack load", async () => {
    mockedLoadCollectionFromFS.mockReturnValueOnce(new Promise(() => {}));
    const source = iconifyLocalSource("mdi", {
      allowed: ["search", "not-real"],
    });

    await expect(source.listIcons?.()).resolves.toEqual(["search", "not-real"]);
  });
});

describe("iconifyLocalSource / checkPreconditions", () => {
  // Regression: before `checkPreconditions()` existed, a missing pack only ever surfaced from individual
  // `getIcon` calls during a build - `listIcons()` returned an `allowed` allowlist without ever
  // checking, and in non-strict mode (the default) each getIcon failure is just warned-and-
  // skipped, burying "the whole pack is missing" as N separate per-icon warnings instead of one
  // clear failure. `createIconLoader`/`createLiveIconLoader` both call `checkPreconditions()` before
  // anything else specifically to catch this.
  it("throws when the pack isn't installed, even with an allowlist set", async () => {
    mockedLoadCollectionFromFS.mockResolvedValueOnce(undefined);
    // A pack name that doesn't exist anywhere on disk (unlike "mdi", genuinely installed for
    // other tests in this suite) so the `require.resolve` fallback (#263) can't find it either -
    // otherwise this would pass for the wrong reason even without the fix under test.
    const source = iconifyLocalSource(
      "definitely-not-a-real-iconify-pack-xyz",
      {
        allowed: ["search"],
      },
    );

    await expect(source.checkPreconditions?.()).rejects.toThrow(
      /isn't installed/i,
    );
  });

  it("resolves once the pack load confirms the pack is installed", async () => {
    mockedLoadCollectionFromFS.mockResolvedValueOnce(pack);
    const source = iconifyLocalSource("mdi");

    await expect(source.checkPreconditions?.()).resolves.toBeUndefined();
  });
});

describe("iconifyLocalSource / pack cache sharing", () => {
  it("shares a resolved local pack across separate iconifyLocalSource() instances", async () => {
    mockedLoadCollectionFromFS.mockResolvedValueOnce(pack);

    await iconifyLocalSource("mdi").getIcon("search");
    await iconifyLocalSource("mdi").getIcon("menu");

    expect(mockedLoadCollectionFromFS).toHaveBeenCalledOnce();
  });
});

describe("iconifyLocalSource / fails eagerly", () => {
  it("starts resolving the local pack as soon as the source is constructed, not on first getIcon/listIcons", () => {
    mockedLoadCollectionFromFS.mockResolvedValueOnce(pack);

    iconifyLocalSource("mdi");

    // No getIcon()/listIcons() call above - the pack load already started regardless.
    expect(mockedLoadCollectionFromFS).toHaveBeenCalledOnce();
  });

  // `loadLocalPack` itself never actually rejects today (both its internal paths self-catch to
  // `undefined`) - mocking `pack.js` directly, rather than `loadCollectionFromFS`, is the only
  // way to exercise a genuine rejection and prove the eager `.catch(() => {})` guard (see
  // source.ts) keeps it from becoming an unhandled rejection for a source that's constructed but
  // never awaited by anything.
  it("doesn't produce an unhandled rejection when a constructed-but-never-awaited source's pack load rejects", async () => {
    vi.resetModules();
    vi.doMock("../src/content/iconify/pack.js", () => ({
      loadLocalPack: vi.fn(() => Promise.reject(new Error("boom"))),
      loadPackFromAPI: vi.fn(),
    }));
    const { iconifyLocalSource: isolatedIconifyLocalSource } =
      await import("../src/content/iconify/source.js");

    expect(() => isolatedIconifyLocalSource("mdi")).not.toThrow();
    // Let the already-rejected promise's microtask settle before the test ends; if the
    // `.catch(() => {})` guard were missing, vitest would report this as an unhandled rejection.
    await new Promise((resolve) => setTimeout(resolve, 0));

    vi.doUnmock("../src/content/iconify/pack.js");
  });
});

describe("iconifyLocalSource / resolveRoot", () => {
  it("resolves the eager pack load against process.cwd() until resolveRoot anchors it elsewhere", () => {
    mockedLoadCollectionFromFS.mockResolvedValueOnce(pack);

    iconifyLocalSource("mdi");

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

    const source = iconifyLocalSource("mdi");
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

    const source = iconifyLocalSource("mdi");
    source.resolveRoot?.(new URL(`file://${process.cwd()}/`));

    expect(mockedLoadCollectionFromFS).toHaveBeenCalledOnce();
  });
});
