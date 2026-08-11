import type { IconifyJSON } from "@iconify/types";
import { afterEach, describe, expect, it, vi } from "vitest";

const loadCollectionFromFS = vi.fn();
vi.mock("@iconify/utils/lib/loader/fs", () => ({ loadCollectionFromFS }));

const { resolvePack, __clearPackCache } = await import(
  "../src/iconify/resolvePack.js"
);

const search: IconifyJSON = {
  prefix: "mdi",
  icons: { search: { body: "<path/>", width: 24, height: 24 } },
};

function logger() {
  return { warn: vi.fn(), debug: vi.fn() };
}

afterEach(() => {
  vi.unstubAllGlobals();
  loadCollectionFromFS.mockReset();
  __clearPackCache();
});

describe("resolvePack", () => {
  it("returns the locally loaded collection when available", async () => {
    loadCollectionFromFS.mockResolvedValueOnce(search);
    const result = await resolvePack("mdi", undefined, { logger: logger() });
    expect(result).toBe(search);
  });

  it("warns and falls back to the Iconify API for a requested icon when the pack isn't installed", async () => {
    loadCollectionFromFS.mockResolvedValueOnce(undefined);
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify(search), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const warn = vi.fn();
    const result = await resolvePack("mdi", ["search"], { logger: { warn, debug: vi.fn() } });

    expect(warn).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("api.iconify.design/mdi.json?icons=search"),
    );
    expect(result).toEqual(search);
  });

  it("throws when no icons are requested and the pack isn't installed", async () => {
    // The public Iconify API can't return "the whole pack" - only an
    // explicit `icons=` subset - so a full-pack request has nothing to
    // fall back to.
    loadCollectionFromFS.mockResolvedValueOnce(undefined);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      resolvePack("mdi", undefined, { logger: logger() }),
    ).rejects.toThrow(/mdi/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("scopes the API fallback to requested icons", async () => {
    loadCollectionFromFS.mockResolvedValueOnce(undefined);
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify(search), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await resolvePack("mdi", ["search", "menu"], { logger: logger() });

    // Requested icons are sorted before being cached/queried, so the URL's
    // exact ordering doesn't matter here - just that both were requested.
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/icons=(search%2Cmenu|menu%2Csearch)/),
    );
  });

  it("throws instead of falling back under strict", async () => {
    loadCollectionFromFS.mockResolvedValueOnce(undefined);
    await expect(
      resolvePack("mdi", undefined, { strict: true, logger: logger() }),
    ).rejects.toThrow(/mdi/);
  });

  it("throws when the API fallback also fails to resolve", async () => {
    loadCollectionFromFS.mockResolvedValueOnce(undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Not Found", { status: 404 })),
    );
    await expect(
      resolvePack("mdi", ["search"], { logger: logger() }),
    ).rejects.toThrow(/mdi/);
  });

  it("throws when the API returns its 200-with-body-'404' sentinel for an unrecognized pack", async () => {
    loadCollectionFromFS.mockResolvedValueOnce(undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("404", { status: 200 })),
    );
    await expect(
      resolvePack("not-a-real-pack", ["search"], { logger: logger() }),
    ).rejects.toThrow(/not-a-real-pack/);
  });
});

describe("resolvePack pack cache", () => {
  it("shares a locally resolved pack across separate resolvePack calls", async () => {
    loadCollectionFromFS.mockResolvedValueOnce(search);

    await resolvePack("mdi", undefined, { logger: logger() });
    await resolvePack("mdi", ["search"], { logger: logger() });

    expect(loadCollectionFromFS).toHaveBeenCalledOnce();
  });

  it("shares an API-fallback fetch across calls requesting the same icon subset", async () => {
    loadCollectionFromFS.mockResolvedValue(undefined);
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify(search), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await resolvePack("mdi", ["search"], { logger: logger() });
    await resolvePack("mdi", ["search"], { logger: logger() });

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("does not cache a failed resolution - a later call can still succeed", async () => {
    loadCollectionFromFS.mockResolvedValue(undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Not Found", { status: 404 })),
    );

    await expect(
      resolvePack("mdi", ["search"], { logger: logger() }),
    ).rejects.toThrow();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(search), { status: 200 })),
    );

    await expect(
      resolvePack("mdi", ["search"], { logger: logger() }),
    ).resolves.toEqual(search);
  });

  it("only warns about a missing local pack once, even across different icons", async () => {
    // A live source resolves one icon at a time (each its own API-fallback
    // cache entry), so without dedup this would otherwise warn once per
    // distinct icon ever requested through it.
    loadCollectionFromFS.mockResolvedValue(undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(search), { status: 200 })),
    );

    const warn = vi.fn();
    await resolvePack("mdi", ["search"], { logger: { warn, debug: vi.fn() } });
    await resolvePack("mdi", ["menu"], { logger: { warn, debug: vi.fn() } });
    await resolvePack("mdi", ["home"], { logger: { warn, debug: vi.fn() } });

    expect(warn).toHaveBeenCalledOnce();
  });

  it("warns again for a different pack", async () => {
    loadCollectionFromFS.mockResolvedValue(undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(search), { status: 200 })),
    );

    const warn = vi.fn();
    await resolvePack("mdi", ["search"], { logger: { warn, debug: vi.fn() } });
    await resolvePack("ic", ["search"], { logger: { warn, debug: vi.fn() } });

    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe("resolvePack timing logs", () => {
  it("logs a debug timing line for a local resolution, distinct from an API fallback", async () => {
    loadCollectionFromFS.mockResolvedValueOnce(search);
    const debug = vi.fn();

    await resolvePack("mdi", undefined, { logger: { warn: vi.fn(), debug } });

    expect(debug).toHaveBeenCalledOnce();
    expect(debug.mock.calls[0][0]).toMatch(/Resolved "mdi" from a local install in/);
  });

  it("logs separate debug timing lines for the local miss and the API fallback", async () => {
    loadCollectionFromFS.mockResolvedValueOnce(undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(search), { status: 200 })),
    );
    const debug = vi.fn();

    await resolvePack("mdi", ["search"], { logger: { warn: vi.fn(), debug } });

    const messages = debug.mock.calls.map(([message]) => message);
    expect(messages.some((m) => /isn't installed locally \(checked in/.test(m))).toBe(true);
    expect(messages.some((m) => /Resolved 1 icon\(s\) of "mdi" from the Iconify API in/.test(m))).toBe(
      true,
    );
  });
});
