import type { IconifyJSON } from "@iconify/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __clearPackCache,
  __setLoadFromFS,
  loadLocalPack,
  loadPackFromAPI,
} from "../src/content/iconify/pack.js";

const loadCollectionFromFS = vi.fn();
__setLoadFromFS(loadCollectionFromFS);

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
});
