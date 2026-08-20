import path from "node:path";
import { fileURLToPath } from "node:url";
import type { IconifyJSON } from "@iconify/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __clearPackCache,
  __requireResolvePack,
  __setLoadFromFS,
  __setLoadViaRequireResolve,
  loadLocalPack,
  loadPackFromAPI,
} from "../src/content/iconify/pack.js";

const loadCollectionFromFS = vi.fn();
__setLoadFromFS(loadCollectionFromFS);

const requireResolveFallback = vi.fn();
__setLoadViaRequireResolve(requireResolveFallback);

const search: IconifyJSON = {
  prefix: "mdi",
  icons: { search: { body: "<path/>", width: 24, height: 24 } },
};

function logger() {
  return { debug: vi.fn() };
}

afterEach(() => {
  vi.unstubAllGlobals();
  loadCollectionFromFS.mockReset();
  requireResolveFallback.mockReset();
  __clearPackCache();
});

describe("loadLocalPack", () => {
  it("returns the locally loaded collection when available", async () => {
    loadCollectionFromFS.mockResolvedValueOnce(search);
    await expect(loadLocalPack("mdi")).resolves.toBe(search);
  });

  it("resolves undefined when the pack isn't installed", async () => {
    loadCollectionFromFS.mockResolvedValueOnce(undefined);
    await expect(loadLocalPack("mdi")).resolves.toBeUndefined();
  });

  it("shares a locally resolved pack across separate calls", async () => {
    loadCollectionFromFS.mockResolvedValueOnce(search);

    await loadLocalPack("mdi");
    await loadLocalPack("mdi");

    expect(loadCollectionFromFS).toHaveBeenCalledOnce();
  });

  // `loadFromFS` resolves via a filesystem-only ESM resolver that walks `node_modules` on
  // disk, so it can't see a package resolved through Yarn Berry's PnP `.pnp.cjs` hook (no
  // `node_modules` to walk at all). `require.resolve` goes through the real CJS loader, so it
  // works under PnP too. See https://github.com/natemoo-re/astro-icon/issues/263.
  describe("require.resolve fallback (#263)", () => {
    it("falls back to require.resolve when loadFromFS can't find the pack", async () => {
      loadCollectionFromFS.mockResolvedValueOnce(undefined);
      requireResolveFallback.mockResolvedValueOnce(search);

      await expect(loadLocalPack("mdi")).resolves.toBe(search);
      expect(requireResolveFallback).toHaveBeenCalledWith("mdi");
    });

    it("doesn't fall back when loadFromFS already found the pack", async () => {
      loadCollectionFromFS.mockResolvedValueOnce(search);

      await loadLocalPack("mdi");

      expect(requireResolveFallback).not.toHaveBeenCalled();
    });

    it("resolves undefined when neither loadFromFS nor the fallback find the pack", async () => {
      loadCollectionFromFS.mockResolvedValueOnce(undefined);
      requireResolveFallback.mockResolvedValueOnce(undefined);

      await expect(loadLocalPack("mdi")).resolves.toBeUndefined();
    });

    it("finds a real pack via require.resolve, the same way it works under Yarn PnP, when run from a nested package with no local node_modules", async () => {
      // Reuses the `monorepoHoisting` fixture: `apps/consumer` has its own
      // package.json but deliberately no node_modules of its own, so this
      // only passes if `require.resolve` walks up to the fixture root's
      // node_modules on its own - the same directory-walking CJS resolution
      // Node's loader (and Yarn PnP's `.pnp.cjs` hook) both honor.
      loadCollectionFromFS.mockResolvedValueOnce(undefined);
      __setLoadViaRequireResolve(__requireResolvePack);

      const fixtureRoot = path.resolve(
        fileURLToPath(new URL(".", import.meta.url)),
        "fixtures/monorepo-hoisting",
      );
      const consumerDir = path.join(fixtureRoot, "apps/consumer");
      const originalCwd = process.cwd();
      process.chdir(consumerDir);

      try {
        const result = await loadLocalPack("test-pack");
        expect(result?.prefix).toBe("test-pack");
        expect(result?.icons.foo).toBeDefined();
      } finally {
        process.chdir(originalCwd);
        __setLoadViaRequireResolve(requireResolveFallback);
      }
    });
  });
});

describe("loadPackFromAPI", () => {
  it("resolves the requested icons from the public API", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify(search), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadPackFromAPI("mdi", ["search"], {
      logger: logger(),
    });

    expect(result).toEqual(search);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("api.iconify.design/mdi.json?icons=search"),
    );
  });

  it("throws when no icons are requested", async () => {
    // The public Iconify API can't return "the whole pack" - only an
    // explicit `icons=` subset - so a full-pack request has nothing to resolve.
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      loadPackFromAPI("mdi", [], { logger: logger() }),
    ).rejects.toThrow(/mdi/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("scopes the request to requested icons", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify(search), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await loadPackFromAPI("mdi", ["search", "menu"], { logger: logger() });

    // Requested icons are sorted before being cached/queried, so the URL's
    // exact ordering doesn't matter here - just that both were requested.
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/icons=(search%2Cmenu|menu%2Csearch)/),
    );
  });

  it("throws when the fetch fails to resolve", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Not Found", { status: 404 })),
    );
    await expect(
      loadPackFromAPI("mdi", ["search"], { logger: logger() }),
    ).rejects.toThrow(/mdi/);
  });

  it("throws when the API returns its 200-with-body-'404' sentinel for an unrecognized pack", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("404", { status: 200 })),
    );
    await expect(
      loadPackFromAPI("not-a-real-pack", ["search"], { logger: logger() }),
    ).rejects.toThrow(/not-a-real-pack/);
  });

  it("shares a fetch across calls requesting the same icon subset", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify(search), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await loadPackFromAPI("mdi", ["search"], { logger: logger() });
    await loadPackFromAPI("mdi", ["search"], { logger: logger() });

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("does not cache a failed resolution - a later call can still succeed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Not Found", { status: 404 })),
    );
    await expect(
      loadPackFromAPI("mdi", ["search"], { logger: logger() }),
    ).rejects.toThrow();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(search), { status: 200 })),
    );
    await expect(
      loadPackFromAPI("mdi", ["search"], { logger: logger() }),
    ).resolves.toEqual(search);
  });

  it("logs a debug timing line", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(search), { status: 200 })),
    );
    const debug = vi.fn();

    await loadPackFromAPI("mdi", ["search"], { logger: { debug } });

    expect(debug).toHaveBeenCalledOnce();
    expect(debug.mock.calls[0][0]).toMatch(
      /Loaded 1 icon\(s\) of "mdi" from the Iconify API in/,
    );
  });

  describe("chunking a large icons list across multiple requests", () => {
    function packWith(names: string[]): IconifyJSON {
      return {
        prefix: "mdi",
        icons: Object.fromEntries(
          names.map((name) => [name, { body: `<path d="${name}"/>` }]),
        ),
      };
    }

    it("splits an icons list over 200 into multiple requests and merges the results", async () => {
      const names = Array.from({ length: 250 }, (_, i) => `icon-${i}`);
      const fetchMock = vi.fn(async (url: string) => {
        const requested = new URL(url).searchParams.get("icons")!.split(",");
        return new Response(JSON.stringify(packWith(requested)), {
          status: 200,
        });
      });
      vi.stubGlobal("fetch", fetchMock);

      const result = await loadPackFromAPI("mdi", names, {
        logger: logger(),
      });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(Object.keys(result.icons)).toHaveLength(250);
      for (const name of names) {
        expect(result.icons[name]).toBeDefined();
      }
    });

    it("stays a single request for an icons list at or under the chunk size", async () => {
      const names = Array.from({ length: 200 }, (_, i) => `icon-${i}`);
      const fetchMock = vi.fn(
        async () => new Response(JSON.stringify(packWith(names)), {
          status: 200,
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      await loadPackFromAPI("mdi", names, { logger: logger() });

      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it("fails the whole load if any one chunk fails, matching the single-request contract", async () => {
      const names = Array.from({ length: 250 }, (_, i) => `icon-${i}`);
      let call = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
          call++;
          if (call === 2) return new Response("Not Found", { status: 404 });
          const requested = new URL(url).searchParams.get("icons")!.split(",");
          return new Response(JSON.stringify(packWith(requested)), {
            status: 200,
          });
        }),
      );

      await expect(
        loadPackFromAPI("mdi", names, { logger: logger() }),
      ).rejects.toThrow(/mdi/);
    });
  });
});
