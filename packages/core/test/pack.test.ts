import path from "node:path";
import { fileURLToPath } from "node:url";
import type { IconifyJSON } from "@iconify/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@iconify/utils/lib/loader/fs", () => ({
  loadCollectionFromFS: vi.fn(),
}));

vi.mock("../src/content/iconify/packResolver.js", () => ({
  createIconifyPackResolver: vi.fn(),
}));

const search: IconifyJSON = {
  prefix: "mdi",
  icons: { search: { body: "<path/>", width: 24, height: 24 } },
};

function logger() {
  return { debug: vi.fn() };
}

// `pack.ts` caches resolved packs in a module-level Map, shared across every import within the
// same module registry. Resetting the registry before each test - rather than exposing a
// test-only cache-clearing export from `pack.ts` - gets every test a fresh, empty cache.
let loadLocalPack: (typeof import("../src/content/iconify/pack.js"))["loadLocalPack"];
let loadPackFromAPI: (typeof import("../src/content/iconify/pack.js"))["loadPackFromAPI"];
let mockedLoadCollectionFromFS: ReturnType<typeof vi.fn>;
let mockedCreateResolver: ReturnType<typeof vi.fn>;
// The resolver's own `loadIcons` - what require.resolve fallback (#263) actually calls.
let mockedLoadIcons: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.resetModules();
  ({ loadLocalPack, loadPackFromAPI } =
    await import("../src/content/iconify/pack.js"));
  const { loadCollectionFromFS } = await import("@iconify/utils/lib/loader/fs");
  mockedLoadCollectionFromFS = vi.mocked(loadCollectionFromFS);
  mockedLoadCollectionFromFS.mockReset();
  const { createIconifyPackResolver } =
    await import("../src/content/iconify/packResolver.js");
  mockedCreateResolver = vi.mocked(createIconifyPackResolver);
  mockedLoadIcons = vi.fn();
  mockedCreateResolver.mockReset();
  mockedCreateResolver.mockImplementation((cwd: string) => ({
    cwd,
    resolveFile: vi.fn(),
    loadIcons: mockedLoadIcons,
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadLocalPack", () => {
  it("returns the locally loaded collection when available", async () => {
    mockedLoadCollectionFromFS.mockResolvedValueOnce(search);
    await expect(loadLocalPack("mdi")).resolves.toBe(search);
  });

  it("resolves undefined when the pack isn't installed", async () => {
    mockedLoadCollectionFromFS.mockResolvedValueOnce(undefined);
    await expect(loadLocalPack("mdi")).resolves.toBeUndefined();
  });

  it("shares a locally resolved pack across separate calls", async () => {
    mockedLoadCollectionFromFS.mockResolvedValueOnce(search);

    await loadLocalPack("mdi");
    await loadLocalPack("mdi");

    expect(mockedLoadCollectionFromFS).toHaveBeenCalledOnce();
  });

  // `loadCollectionFromFS` resolves via a filesystem-only ESM resolver that walks `node_modules`
  // on disk, so it can't see a package resolved through Yarn Berry's PnP `.pnp.cjs` hook (no
  // `node_modules` to walk at all). `require.resolve` goes through the real CJS loader, so it
  // works under PnP too. See https://github.com/natemoo-re/astro-icon/issues/263.
  describe("require.resolve fallback (#263)", () => {
    it("falls back to require.resolve when loadCollectionFromFS can't find the pack", async () => {
      mockedLoadCollectionFromFS.mockResolvedValueOnce(undefined);
      mockedLoadIcons.mockResolvedValueOnce(search);

      await expect(loadLocalPack("mdi")).resolves.toBe(search);
      expect(mockedCreateResolver).toHaveBeenCalledWith(process.cwd());
      expect(mockedLoadIcons).toHaveBeenCalledWith("mdi");
    });

    it("doesn't fall back when loadCollectionFromFS already found the pack", async () => {
      mockedLoadCollectionFromFS.mockResolvedValueOnce(search);

      await loadLocalPack("mdi");

      expect(mockedLoadIcons).not.toHaveBeenCalled();
    });

    it("resolves undefined when neither loadCollectionFromFS nor the fallback find the pack", async () => {
      mockedLoadCollectionFromFS.mockResolvedValueOnce(undefined);
      mockedLoadIcons.mockResolvedValueOnce(undefined);

      await expect(loadLocalPack("mdi")).resolves.toBeUndefined();
    });

    it("finds a real pack via require.resolve, the same way it works under Yarn PnP, when run from a nested package with no local node_modules", async () => {
      // Reuses the `monorepoHoisting` fixture: `apps/consumer` has its own
      // package.json but deliberately no node_modules of its own, so this
      // only passes if `require.resolve` walks up to the fixture root's
      // node_modules on its own - the same directory-walking CJS resolution
      // Node's loader (and Yarn PnP's `.pnp.cjs` hook) both honor.
      mockedLoadCollectionFromFS.mockResolvedValueOnce(undefined);
      const { createIconifyPackResolver: actualCreateResolver } =
        await vi.importActual<
          typeof import("../src/content/iconify/packResolver.js")
        >("../src/content/iconify/packResolver.js");
      mockedCreateResolver.mockImplementationOnce(actualCreateResolver);

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
        async () =>
          new Response(JSON.stringify(packWith(names)), {
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

  describe("retrying a 429 response", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(0);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("retries after the delay given by Retry-After, then succeeds", async () => {
      const timestamps: number[] = [];
      let call = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          timestamps.push(Date.now());
          call++;
          if (call === 1) {
            return new Response("", {
              status: 429,
              headers: { "retry-after": "2" },
            });
          }
          return new Response(JSON.stringify(search), { status: 200 });
        }),
      );

      const resultPromise = loadPackFromAPI("mdi", ["search"], {
        logger: logger(),
      });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toEqual(search);
      expect(timestamps).toEqual([0, 2000]);
    });

    it("falls back to exponential backoff when Retry-After is absent", async () => {
      const timestamps: number[] = [];
      let call = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          timestamps.push(Date.now());
          call++;
          if (call <= 2) return new Response("", { status: 429 });
          return new Response(JSON.stringify(search), { status: 200 });
        }),
      );

      const resultPromise = loadPackFromAPI("mdi", ["search"], {
        logger: logger(),
      });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toEqual(search);
      // Doubling from a 500ms base: first retry waits 500ms, second waits 1000ms.
      expect(timestamps).toEqual([0, 500, 1500]);
    });

    it("gives up after the retry cap and fails the load", async () => {
      const fetchMock = vi.fn(async () => new Response("", { status: 429 }));
      vi.stubGlobal("fetch", fetchMock);

      const resultPromise = loadPackFromAPI("mdi", ["search"], {
        logger: logger(),
      });
      const assertion = expect(resultPromise).rejects.toThrow(/mdi/);
      await vi.runAllTimersAsync();
      await assertion;
      // 3 retries after the initial attempt = 4 fetches total.
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it("doesn't retry a non-429 failure", async () => {
      const fetchMock = vi.fn(
        async () => new Response("Not Found", { status: 404 }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const before = Date.now();
      await expect(
        loadPackFromAPI("mdi", ["search"], { logger: logger() }),
      ).rejects.toThrow(/mdi/);
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(Date.now() - before).toBe(0);
    });

    it("never sleeps on a plain success", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(
          async () => new Response(JSON.stringify(search), { status: 200 }),
        ),
      );

      const before = Date.now();
      await loadPackFromAPI("mdi", ["search"], { logger: logger() });

      expect(Date.now() - before).toBe(0);
    });
  });
});
