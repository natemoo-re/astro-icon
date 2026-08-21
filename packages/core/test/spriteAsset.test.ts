import { describe, expect, it, vi } from "vitest";
import {
  renderSpriteAsset,
  spriteAssetId,
  warnIfSpriteAssetIsLarge,
} from "../src/content/sprite/asset.js";
import { spriteSymbolId } from "../src/internal/spriteManifest.js";
import type { BuiltIcon } from "../src/content/buildIcons.js";

function icon(name: string, body = `<path d="${name}"/>`): BuiltIcon {
  return { name, data: { body, viewBox: "0 0 24 24", width: 24, height: 24 } };
}

describe("spriteAssetId", () => {
  it("is deterministic for the same icon set", () => {
    const icons = [icon("home"), icon("search")];
    expect(spriteAssetId(icons)).toBe(spriteAssetId(icons));
  });

  it("agrees regardless of input order - callers computing it independently shouldn't have to agree on ordering", () => {
    expect(spriteAssetId([icon("home"), icon("search")])).toBe(
      spriteAssetId([icon("search"), icon("home")]),
    );
  });

  it("changes when an icon's body changes", () => {
    const before = spriteAssetId([icon("home", "<path/>")]);
    const after = spriteAssetId([icon("home", "<path d='different'/>")]);
    expect(before).not.toBe(after);
  });

  it("changes when the icon set changes, even if total content length matches", () => {
    expect(spriteAssetId([icon("home")])).not.toBe(
      spriteAssetId([icon("search")]),
    );
  });
});

describe("renderSpriteAsset", () => {
  it("renders one namespaced <symbol> per icon", () => {
    const svg = renderSpriteAsset("mdi", [icon("home"), icon("search")]);
    expect(svg).toContain(`<symbol id="${spriteSymbolId("mdi", "home")}"`);
    expect(svg).toContain(`<symbol id="${spriteSymbolId("mdi", "search")}"`);
  });

  it("carries each icon's viewBox and body", () => {
    const svg = renderSpriteAsset("mdi", [icon("home", "<path d='M0 0'/>")]);
    expect(svg).toContain('viewBox="0 0 24 24"');
    expect(svg).toContain("<path d='M0 0'/>");
  });

  it("renders a valid, self-contained svg root for an empty icon set", () => {
    expect(renderSpriteAsset("mdi", [])).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    );
  });
});

describe("warnIfSpriteAssetIsLarge", () => {
  function logger() {
    return { warn: vi.fn() };
  }

  it("stays silent for a small, ordinarily-scoped collection", () => {
    const log = logger();
    warnIfSpriteAssetIsLarge(
      log,
      "icons",
      [icon("home"), icon("search")],
      "<svg></svg>",
    );
    expect(log.warn).not.toHaveBeenCalled();
  });

  it("warns once the icon count crosses the threshold, even if the total bytes are small", () => {
    const log = logger();
    const icons = Array.from({ length: 301 }, (_, i) => icon(`icon-${i}`, ""));
    warnIfSpriteAssetIsLarge(log, "mdi", icons, "<svg></svg>");
    expect(log.warn).toHaveBeenCalledOnce();
  });

  it("warns once the byte size crosses the threshold, even with few icons", () => {
    const log = logger();
    const hugeBody = "x".repeat(200_000);
    warnIfSpriteAssetIsLarge(
      log,
      "mdi",
      [icon("home")],
      `<svg>${hugeBody}</svg>`,
    );
    expect(log.warn).toHaveBeenCalledOnce();
  });

  it("states the real collection name, icon count, and a size in the message - not a generic warning", () => {
    const log = logger();
    const icons = Array.from({ length: 500 }, (_, i) => icon(`icon-${i}`));
    warnIfSpriteAssetIsLarge(
      log,
      "mdi",
      icons,
      renderSpriteAsset("mdi", icons),
    );
    const message = log.warn.mock.calls[0]?.[0] as string;
    expect(message).toContain('"mdi"');
    expect(message).toContain("500 icon(s)");
    expect(message).toMatch(/\d+(\.\d+)?KB/);
    expect(message).toContain("icons: [...]");
  });
});
