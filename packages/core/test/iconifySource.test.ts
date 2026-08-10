import type { IconifyJSON } from "@iconify/types";
import { afterEach, describe, expect, it, vi } from "vitest";

const loadCollectionFromFS = vi.fn();
vi.mock("@iconify/utils/lib/loader/fs", () => ({ loadCollectionFromFS }));

const { iconifySource } = await import("../src/iconify/iconifySource.js");
const { __clearPackCache } = await import(
  "../src/iconify/resolvePack.js"
);

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

afterEach(() => {
  vi.unstubAllGlobals();
  loadCollectionFromFS.mockReset();
  __clearPackCache();
});

describe("iconifySource", () => {
  it("names the source after the pack, matching the collection-key convention live typegen relies on", () => {
    expect(iconifySource("mdi").name).toBe("mdi");
  });
});

describe("iconifySource / local pack", () => {
  it("resolves a single icon via getIcon", async () => {
    loadCollectionFromFS.mockResolvedValueOnce(pack);
    const source = iconifySource("mdi");

    const entry = await source.getIcon("search");

    expect(entry.viewBox).toBe("0 0 24 24");
  });

  it("throws for an icon the pack doesn't have", async () => {
    loadCollectionFromFS.mockResolvedValueOnce(pack);
    const source = iconifySource("mdi");

    await expect(source.getIcon("does-not-exist")).rejects.toThrow(/mdi/);
  });

  it("lists icon and alias names via listIcons", async () => {
    loadCollectionFromFS.mockResolvedValueOnce(pack);
    const source = iconifySource("mdi");

    const names = await source.listIcons?.();

    expect(names).toEqual(["search", "menu", "find"]);
  });

  it("only resolves the local pack once across getIcon/listIcons calls", async () => {
    loadCollectionFromFS.mockResolvedValueOnce(pack);
    const source = iconifySource("mdi");

    await source.getIcon("search");
    await source.listIcons?.();
    await source.getIcon("menu");

    expect(loadCollectionFromFS).toHaveBeenCalledOnce();
  });
});

describe("iconifySource / getVersion", () => {
  it("resolves undefined (never crashes) for a pack that isn't installed", async () => {
    const source = iconifySource("definitely-not-a-real-iconify-pack-xyz");

    await expect(source.getVersion?.()).resolves.toBeUndefined();
  });
});

describe("iconifySource / API fallback (pack not installed)", () => {
  it("resolves each requested icon individually, scoped to just that icon", async () => {
    loadCollectionFromFS.mockResolvedValue(undefined);
    const fetchMock = vi.fn(async (url: string) => {
      const requested = new URL(url).searchParams.get("icons");
      return new Response(
        JSON.stringify({
          prefix: "mdi",
          icons: { [requested!]: pack.icons[requested!] },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const source = iconifySource("mdi");
    const first = await source.getIcon("search");
    const second = await source.getIcon("menu");

    expect(first.viewBox).toBe("0 0 24 24");
    expect(second.viewBox).toBe("0 0 24 24");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("icons=search"),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("icons=menu"),
    );
  });

  it("errors on listIcons instead of pretending to enumerate a remote-only pack", async () => {
    loadCollectionFromFS.mockResolvedValue(undefined);
    const source = iconifySource("mdi");

    await expect(source.listIcons?.()).rejects.toThrow(/mdi/);
  });
});

describe("iconifySource / icons allowlist", () => {
  it("rejects a name not in the allowlist without touching the pack", async () => {
    const source = iconifySource("mdi", { icons: ["search"] });

    await expect(source.getIcon("menu")).rejects.toThrow(/isn't in the allowed/i);
    expect(loadCollectionFromFS).not.toHaveBeenCalled();
  });

  it("resolves an allowed name normally", async () => {
    loadCollectionFromFS.mockResolvedValueOnce(pack);
    const source = iconifySource("mdi", { icons: ["search"] });

    await expect(source.getIcon("search")).resolves.toMatchObject({ viewBox: "0 0 24 24" });
  });

  it("types exactly the given allowlist, without checking the pack", async () => {
    const source = iconifySource("mdi", { icons: ["search", "not-real"] });

    await expect(source.listIcons?.()).resolves.toEqual(["search", "not-real"]);
    expect(loadCollectionFromFS).not.toHaveBeenCalled();
  });
});

describe("iconifySource / pack cache sharing", () => {
  it("shares a resolved local pack across separate iconifySource() instances", async () => {
    // Mirrors the build `iconify()` loader and a live `iconifySource()`
    // both referencing the same pack - each gets its own IconSource/Loader,
    // but the underlying pack read should only happen once.
    loadCollectionFromFS.mockResolvedValueOnce(pack);

    await iconifySource("mdi").getIcon("search");
    await iconifySource("mdi").getIcon("menu");

    expect(loadCollectionFromFS).toHaveBeenCalledOnce();
  });
});
