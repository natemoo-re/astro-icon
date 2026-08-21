import { describe, expect, it } from "vitest";
import {
  resolveSpriteRenderMode,
  spriteSymbolId,
} from "../src/render/spriteMode.js";

const spritedEntry = { hash: "abc123", assetIcons: "all" as const };

describe("resolveSpriteRenderMode", () => {
  it("renders inline when the collection has no manifest entry (no integration, or sprite: false)", () => {
    expect(
      resolveSpriteRenderMode({
        inline: false,
        manifestEntry: undefined,
        isPrerendered: true,
        assetsPrefix: undefined,
        collection: "mdi",
        name: "home",
      }),
    ).toEqual({ kind: "inline" });
  });

  it("renders inline when the caller opts out via the inline prop, even on a sprited collection", () => {
    expect(
      resolveSpriteRenderMode({
        inline: true,
        manifestEntry: spritedEntry,
        isPrerendered: false,
        assetsPrefix: undefined,
        collection: "mdi",
        name: "home",
      }),
    ).toEqual({ kind: "inline" });
  });

  it("stays inline on a prerendered page - the build rewrite decides dedup later, not <Icon>", () => {
    expect(
      resolveSpriteRenderMode({
        inline: false,
        manifestEntry: spritedEntry,
        isPrerendered: true,
        assetsPrefix: undefined,
        collection: "mdi",
        name: "home",
      }),
    ).toEqual({ kind: "prerendered" });
  });

  it("references the sprite asset on a server-rendered route", () => {
    expect(
      resolveSpriteRenderMode({
        inline: false,
        manifestEntry: spritedEntry,
        isPrerendered: false,
        assetsPrefix: undefined,
        collection: "mdi",
        name: "home",
      }),
    ).toEqual({
      kind: "asset",
      href: `/_astro/mdi.abc123.svg#${spriteSymbolId("mdi", "home")}`,
    });
  });

  it("reports a miss instead of silently falling back when the asset doesn't include this icon", () => {
    expect(
      resolveSpriteRenderMode({
        inline: false,
        manifestEntry: { hash: "abc123", assetIcons: ["search"] },
        isPrerendered: false,
        assetsPrefix: undefined,
        collection: "mdi",
        name: "home",
      }),
    ).toEqual({ kind: "missing-from-asset" });
  });

  it("treats assetIcons: 'all' as containing every icon in the collection", () => {
    expect(
      resolveSpriteRenderMode({
        inline: false,
        manifestEntry: spritedEntry,
        isPrerendered: false,
        assetsPrefix: undefined,
        collection: "mdi",
        name: "anything",
      }),
    ).toEqual({
      kind: "asset",
      href: `/_astro/mdi.abc123.svg#${spriteSymbolId("mdi", "anything")}`,
    });
  });

  it("prepends assetsPrefix to the asset href, e.g. when assets are served from a CDN", () => {
    expect(
      resolveSpriteRenderMode({
        inline: false,
        manifestEntry: spritedEntry,
        isPrerendered: false,
        assetsPrefix: "https://cdn.example.com",
        collection: "mdi",
        name: "home",
      }),
    ).toEqual({
      kind: "asset",
      href: `https://cdn.example.com/_astro/mdi.abc123.svg#${spriteSymbolId("mdi", "home")}`,
    });
  });
});

describe("spriteSymbolId", () => {
  it("namespaces by collection so two collections can't collide on the same icon name", () => {
    expect(spriteSymbolId("mdi", "home")).not.toBe(
      spriteSymbolId("icons", "home"),
    );
  });
});
