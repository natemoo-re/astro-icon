import type { IconifyJSON } from "@iconify/types";
import { describe, expect, it, vi } from "vitest";
import { buildIconEntry } from "../src/content/iconify/source.js";
import { entryFromIconifyData } from "../src/content/ingest/entryFromIconifyData.js";

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

// A regression pin, not a design test: `entryFromIconifyData` (phase 1's new canonical ingestion
// function) must reproduce `buildIconEntry`'s exact current output - body byte-for-byte - for
// every one of these packs. No `optimize` involved, since `entryFromIconifyData` never accepts
// one; that's `localSource`/the iconify sources' own job in phase 2.
const pins: IconifyJSON = {
  prefix: "mixed",
  icons: {
    // The plain case: a viewBox-sized icon with no transforms.
    search: {
      body: '<path d="M10 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12z"/>',
      width: 24,
      height: 24,
    },
    // A non-default intrinsic size.
    small: {
      body: '<circle cx="8" cy="8" r="4"/>',
      width: 16,
      height: 16,
    },
    // Multiple paths/elements in one body.
    multiPath: {
      body: '<path d="M0 0h24v24H0z" fill="none"/><path d="M12 2 2 22h20z"/>',
      width: 24,
      height: 24,
    },
    // A non-zero left/top box, distinct width/height, and a rotation - exercises `iconToSVG`'s
    // own transform wrapping (a <g transform="..."> around body) and non-"0 0" viewBox origin.
    rotated: {
      body: '<path d="M4 4h8v8H4z"/>',
      left: 2,
      top: 1,
      width: 20,
      height: 12,
      rotate: 1,
    },
    // An aliased name, resolved through the pack's `aliases` map.
    magnify: undefined as never,
  },
  aliases: {
    magnify: { parent: "search" },
  },
};
delete pins.icons.magnify;

function pinContext() {
  return { collection: "mixed", logger: { warn: vi.fn() } };
}

describe("entryFromIconifyData / phase 1 pin against buildIconEntry", () => {
  for (const name of ["search", "small", "multiPath", "rotated", "magnify"]) {
    it(`matches buildIconEntry's current output for "${name}"`, async () => {
      const fromBuildIconEntry = await buildIconEntry(pins, name, pinContext());
      const fromEntryFromIconifyData = entryFromIconifyData(pins, name);
      expect(fromEntryFromIconifyData).toEqual(fromBuildIconEntry);
    });
  }

  it("both return undefined for a name the pack doesn't have", async () => {
    const fromBuildIconEntry = await buildIconEntry(pins, "missing", pinContext());
    const fromEntryFromIconifyData = entryFromIconifyData(pins, "missing");
    expect(fromEntryFromIconifyData).toBeUndefined();
    expect(fromBuildIconEntry).toBeUndefined();
  });
});

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
    const optimize = vi.fn(async (svg: string) =>
      svg.replace("<path", '<path fill="red"'),
    );
    const entry = await buildIconEntry(search, "search", {
      collection: "mdi",
      optimize,
      logger: logger(),
    });
    expect(optimize).toHaveBeenCalledWith(expect.stringContaining("<svg"), {
      collection: "mdi",
      name: "search",
    });
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
