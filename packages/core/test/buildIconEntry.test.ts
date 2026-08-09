import type { IconifyJSON } from "@iconify/types";
import { describe, expect, it, vi } from "vitest";
import { buildIconEntry } from "../src/iconify/buildIconEntry.js";

const search: IconifyJSON = {
  prefix: "mdi",
  icons: {
    search: {
      body: '<path d="M10 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12z"/>',
      width: 24,
      height: 24,
    },
  },
};

function logger() {
  return { warn: vi.fn() };
}

describe("buildIconEntry", () => {
  it("uses the source viewBox when present", async () => {
    const entry = await buildIconEntry(search, "search", {
      collection: "mdi",
      logger: logger(),
    });
    expect(entry).toEqual({
      body: '<path d="M10 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12z"/>',
      viewBox: "0 0 24 24",
      width: 24,
      height: 24,
    });
  });

  it("returns undefined for an icon that doesn't exist", async () => {
    const entry = await buildIconEntry(search, "missing", {
      collection: "mdi",
      logger: logger(),
    });
    expect(entry).toBeUndefined();
  });

  it("passes the raw svg and context to optimize, and uses its result", async () => {
    const optimize = vi.fn(
      async (svg: string) => svg.replace("<path", '<path fill="red"'),
    );
    const entry = await buildIconEntry(search, "search", {
      collection: "mdi",
      optimize,
      logger: logger(),
    });
    expect(optimize).toHaveBeenCalledWith(
      expect.stringContaining("<svg"),
      { collection: "mdi", name: "search" },
    );
    expect(entry?.body).toContain('fill="red"');
  });

  it("derives a viewBox and warns when optimize strips it", async () => {
    const warn = vi.fn();
    const optimize = async (svg: string) =>
      svg.replace(/\s?viewBox="[^"]*"/, "");
    const entry = await buildIconEntry(search, "search", {
      collection: "mdi",
      optimize,
      logger: { warn },
    });
    expect(entry?.viewBox).toBe("0 0 24 24");
    expect(warn).toHaveBeenCalledOnce();
  });

  it("throws instead of deriving a viewBox under strict", async () => {
    const optimize = async (svg: string) =>
      svg.replace(/\s?viewBox="[^"]*"/, "");
    await expect(
      buildIconEntry(search, "search", {
        collection: "mdi",
        optimize,
        strict: true,
        logger: logger(),
      }),
    ).rejects.toThrow(/viewBox/);
  });
});
