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
let iconifyApiSource: (typeof import("../src/content/iconify/apiSource.js"))["iconifyApiSource"];

beforeEach(async () => {
  vi.resetModules();
  ({ iconifyApiSource } = await import("../src/content/iconify/apiSource.js"));
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

describe("iconifyApiSource / host", () => {
  it("resolves icons from a self-hosted API instance instead of the public one", async () => {
    const fetchMock = fetchReturning(() => pack);
    vi.stubGlobal("fetch", fetchMock);

    const source = iconifyApiSource("mdi", {
      allowed: ["search"],
      host: "https://icons.example.com",
    });
    const result = await source.getIcons(["search"]);

    expect(result.get("search")).toMatchObject({ viewBox: "0 0 24 24" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://icons.example.com/mdi.json?icons=search",
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
    const first = await source.getIcons(["search"]);
    const second = await source.getIcons(["menu"]);

    expect((first.get("search") as { viewBox: string }).viewBox).toBe(
      "0 0 24 24",
    );
    expect((second.get("menu") as { viewBox: string }).viewBox).toBe(
      "0 0 24 24",
    );
    // Both names come from the same allowlist, so `loadPackFromAPI`'s cache (keyed by the full
    // sorted list) is shared across both `getIcons` calls - one fetch covers both icons.
    expect(fetchMock).toHaveBeenCalledOnce();
    const requestedUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(requestedUrl.searchParams.get("icons")!.split(",").sort()).toEqual([
      "menu",
      "search",
    ]);
  });
});

describe("iconifyApiSource / batches a single getIcons call, even without an allowlist", () => {
  it("fetches every name in one call's batch with a single request", async () => {
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

    const source = iconifyApiSource("mdi");
    const result = await source.getIcons(["search", "menu"]);

    expect(result.get("search")).toMatchObject({ viewBox: "0 0 24 24" });
    expect(result.get("menu")).toMatchObject({ viewBox: "0 0 24 24" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("still fetches separately across two independent getIcons calls - batching is per call, not across time", async () => {
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
    await source.getIcons(["search"]);
    await source.getIcons(["menu"]);

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
  it("puts a per-name Error in the map for a name outside the allowlist, without fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const source = iconifyApiSource("mdi", { allowed: ["search"] });

    const result = await source.getIcons(["menu"]);

    expect(result.get("menu")).toBeInstanceOf(Error);
    expect((result.get("menu") as Error).message).toMatch(/isn't in the allowed/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("listIcons returns exactly the given allowlist", async () => {
    const source = iconifyApiSource("mdi", { allowed: ["search", "menu"] });

    await expect(source.listIcons?.()).resolves.toEqual(["search", "menu"]);
  });
});

describe("iconifyApiSource / without an icons allowlist (e.g. <LiveIcon> against an uninstalled pack)", () => {
  it("resolves any icon name", async () => {
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

    const result = await source.getIcons(["search"]);

    expect(result.get("search")).toMatchObject({ viewBox: "0 0 24 24" });
  });

  it("throws from listIcons instead of pretending to enumerate the whole pack", async () => {
    const source = iconifyApiSource("mdi");

    await expect(source.listIcons?.()).rejects.toThrow(
      /no fixed set of icon names/i,
    );
  });
});

describe("iconifyApiSource / transform", () => {
  it("applies transform to the built entry, last, before it's returned", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              prefix: "tabler",
              icons: {
                search: {
                  body: '<path stroke-width="2" d="M10 10h4v4h-4z"/>',
                  width: 24,
                  height: 24,
                },
              },
            }),
            { status: 200 },
          ),
      ),
    );
    const source = iconifyApiSource("tabler", {
      allowed: ["search"],
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
});

describe("iconifyApiSource / failure modes", () => {
  it("rejects the whole batch when the API request itself fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Not Found", { status: 404 })),
    );
    const source = iconifyApiSource("mdi", { allowed: ["search"] });

    await expect(source.getIcons(["search"])).rejects.toThrow(/mdi/);
  });
});

describe("iconifyApiSource / pack cache sharing", () => {
  it("shares an API fetch across separate iconifyApiSource() instances requesting the same icon", async () => {
    const fetchMock = fetchReturning(() => pack);
    vi.stubGlobal("fetch", fetchMock);

    await iconifyApiSource("mdi", { allowed: ["search"] }).getIcons(["search"]);
    await iconifyApiSource("mdi", { allowed: ["search"] }).getIcons(["search"]);

    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
