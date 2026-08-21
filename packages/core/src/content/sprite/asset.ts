import { createHash } from "node:crypto";
import type { AstroIntegrationLogger } from "astro";
import { spriteSymbolId } from "../../internal/spriteManifest.js";
import type { BuiltIcon } from "../buildIcons.js";

// Deliberately not configurable - exposing what the build can measure invites tuning in place
// of the actual fix, which is always the same regardless of the exact threshold: scope the
// collection with `icons: [...]`. These are a starting point, not a scientifically derived
// line - the point is to catch the "installed a whole pack with no allowlist" case, not to be
// precise.
const ICON_COUNT_WARN_THRESHOLD = 300;
const BYTES_WARN_THRESHOLD = 150_000;

/**
 * Content-addressed id for a collection's sprite asset. Called from exactly
 * one place today (the loader, right after building), but written to be
 * safely callable from anywhere given the same logical icon set - sorted by
 * name first, so two callers with the same icons in different orders still
 * agree. That's what lets the loader (which records the hash) and a future
 * caller re-deriving it from `getCollection()` output land on the same
 * value without passing it between them.
 */
export function spriteAssetId(icons: BuiltIcon[]): string {
  const canonical = icons
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ name, data }) => `${name}:${data.viewBox}:${data.body}`)
    .join("\n");
  return createHash("sha256").update(canonical).digest("hex").slice(0, 8);
}

/**
 * Renders a collection's sprite asset: one `<symbol>` per icon, hidden,
 * referenced everywhere else by `<use>`. This is the file served at
 * `/_astro/{collection}.{hash}.svg`.
 */
export function renderSpriteAsset(
  collection: string,
  icons: BuiltIcon[],
): string {
  const symbols = icons
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(
      ({ name, data }) =>
        `<symbol id="${spriteSymbolId(collection, name)}" viewBox="${data.viewBox}">${data.body}</symbol>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg">${symbols}</svg>`;
}

/**
 * Warns, with real numbers, when a sprited collection's asset is large
 * enough that every SSR page referencing it - and every visitor loading
 * that asset for the first time - pays a real, avoidable cost. Applies
 * regardless of whether the collection came from a bounded `icons: [...]`
 * allowlist or an unbounded pack - a curated set of 300 icons is just as
 * costly to ship as an unbounded one that happens to total the same size.
 */
export function warnIfSpriteAssetIsLarge(
  logger: Pick<AstroIntegrationLogger, "warn">,
  collection: string,
  icons: BuiltIcon[],
  assetContent: string,
): void {
  const bytes = Buffer.byteLength(assetContent, "utf-8");
  if (
    icons.length <= ICON_COUNT_WARN_THRESHOLD &&
    bytes <= BYTES_WARN_THRESHOLD
  )
    return;

  const kb = (bytes / 1024).toFixed(1);
  logger.warn(
    `The "${collection}" sprite asset is ${kb}KB across ${icons.length} icon(s) - every server-rendered page that references it pays that cost, and every visitor's first request for it does too.\n\nRestrict this collection to only the icons you actually use with the \`icons: [...]\` option, or pass \`{ sprite: false }\` to this loader to opt this collection out of sprite optimization entirely.`,
  );
}
