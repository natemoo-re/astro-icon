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
  it("rejects a name not in the allowlist without touching the pack", async () => {
    const source = iconifyLocalSource("mdi", { allowed: ["search"] });

    await expect(source.getIcon("menu")).rejects.toThrow(
      /isn't in the allowed/i,
    );
    expect(mockedLoadCollectionFromFS).not.toHaveBeenCalled();
  });

  it("resolves an allowed name normally", async () => {
    mockedLoadCollectionFromFS.mockResolvedValueOnce(pack);
    const source = iconifyLocalSource("mdi", { allowed: ["search"] });

    await expect(source.getIcon("search")).resolves.toMatchObject({
      viewBox: "0 0 24 24",
    });
  });

  it("types exactly the given allowlist, without checking the pack", async () => {
    const source = iconifyLocalSource("mdi", { allowed: ["search", "not-real"] });

    await expect(source.listIcons?.()).resolves.toEqual(["search", "not-real"]);
    expect(mockedLoadCollectionFromFS).not.toHaveBeenCalled();
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
