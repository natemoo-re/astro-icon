import type { IconifyJSON } from "@iconify/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pack: IconifyJSON = {
  prefix: "mdi",
  icons: {
    search: { body: "<path/>", width: 24, height: 24 },
    menu: { body: "<path/>", width: 24, height: 24 },
  },
};

// `pack.ts` (used internally by `iconifyApiSource`) caches resolved packs in a module-level Map.
// Resetting the registry before each test - rather than exposing a test-only cache-clearing
// export - gets every test a fresh, empty cache.
let iconifyApiSource: (typeof import("../src/content/iconify/source.js"))["iconifyApiSource"];

beforeEach(async () => {
  vi.resetModules();
  ({ iconifyApiSource } = await import("../src/content/iconify/source.js"));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function fetchReturning(requested: () => IconifyJSON) {
  return vi.fn(
    async () => new Response(JSON.stringify(requested()), { status: 200 }),
  );
}

describe("iconifyApiSource naming", () => {
  it("namespaces the source name with the pack", () => {
    expect(iconifyApiSource("mdi", { allowed: ["search"] }).name).toBe(
      "iconify-api:mdi",
    );
  });
});

describe("iconifyApiSource / concurrency", () => {
  it("sets a default concurrency cap, as a shared-public-API source", () => {
    expect(iconifyApiSource("mdi", { allowed: ["search"] }).concurrency).toBe(
      20,
    );
  });
});

describe("iconifyApiSource / batches an allowlist into one request", () => {
  it("resolves every allowed icon from a single fetch covering the whole allowlist", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const requested = new URL(url).searchParams.get("icons")!.split(",");
      const icons = Object.fromEntries(
        requested.map((name) => [name, pack.icons[name]]),
      );
      return new Response(JSON.stringify({ prefix: "mdi", icons }), {
        status: 200,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const source = iconifyApiSource("mdi", { allowed: ["search", "menu"] });
    const first = await source.getIcon("search");
    const second = await source.getIcon("menu");

    expect(first.viewBox).toBe("0 0 24 24");
    expect(second.viewBox).toBe("0 0 24 24");
    // Both names come from the same allowlist, so `loadPackFromAPI`'s cache (keyed by the full
    // sorted list) is shared across both `getIcon` calls - one fetch covers both icons.
    expect(fetchMock).toHaveBeenCalledOnce();
    const requestedUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(requestedUrl.searchParams.get("icons")!.split(",").sort()).toEqual([
      "menu",
      "search",
    ]);
  });
});

describe("iconifyApiSource / resolves each requested icon individually without an allowlist", () => {
  it("fetches only the requested icon when there's no known set to batch against", async () => {
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

    const source = iconifyApiSource("mdi");
    await source.getIcon("search");
    await source.getIcon("menu");

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
});

describe("iconifyApiSource / icons allowlist is required", () => {
  it("rejects a name not in the allowlist without fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const source = iconifyApiSource("mdi", { allowed: ["search"] });

    await expect(source.getIcon("menu")).rejects.toThrow(
      /isn't in the allowed/i,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("listIcons returns exactly the given allowlist", async () => {
    const source = iconifyApiSource("mdi", { allowed: ["search", "menu"] });

    await expect(source.listIcons?.()).resolves.toEqual(["search", "menu"]);
  });
});

describe("iconifyApiSource / without an icons allowlist (e.g. <LiveIcon> against an uninstalled pack)", () => {
  it("resolves any icon name one at a time", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const requested = new URL(url).searchParams.get("icons");
        return new Response(
          JSON.stringify({
            prefix: "mdi",
            icons: { [requested!]: pack.icons[requested!] },
          }),
          { status: 200 },
        );
      }),
    );
    const source = iconifyApiSource("mdi");

    await expect(source.getIcon("search")).resolves.toMatchObject({
      viewBox: "0 0 24 24",
    });
  });

  it("throws from listIcons instead of pretending to enumerate the whole pack", async () => {
    const source = iconifyApiSource("mdi");

    await expect(source.listIcons?.()).rejects.toThrow(
      /no fixed set of icon names/i,
    );
  });
});

describe("iconifyApiSource / failure modes", () => {
  it("throws when the API fallback fails to resolve", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Not Found", { status: 404 })),
    );
    const source = iconifyApiSource("mdi", { allowed: ["search"] });

    await expect(source.getIcon("search")).rejects.toThrow(/mdi/);
  });
});

describe("iconifyApiSource / pack cache sharing", () => {
  it("shares an API fetch across separate iconifyApiSource() instances requesting the same icon", async () => {
    const fetchMock = fetchReturning(() => pack);
    vi.stubGlobal("fetch", fetchMock);

    await iconifyApiSource("mdi", { allowed: ["search"] }).getIcon("search");
    await iconifyApiSource("mdi", { allowed: ["search"] }).getIcon("search");

    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
