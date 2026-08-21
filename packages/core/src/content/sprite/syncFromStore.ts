import type { AstroIntegrationLogger } from "astro";
import type { LoaderContext } from "astro/loaders";
import type { IconEntry } from "../../../typings/types";
import type { BuiltIcon } from "../buildIcons.js";
import {
  renderSpriteAsset,
  spriteAssetId,
  warnIfSpriteAssetIsLarge,
} from "./asset.js";
import { recordSprite } from "./manifest.js";

/**
 * Records a collection's sprite state from whatever is currently in its
 * content-layer store, rather than requiring an in-memory `BuiltIcon[]` the
 * caller might not have on every sync path.
 */
export async function syncSpriteFromStore(
  rootDir: URL,
  collection: string,
  sprite: boolean,
  store: Pick<LoaderContext["store"], "entries">,
  logger: Pick<AstroIntegrationLogger, "warn">,
): Promise<void> {
  if (!sprite) {
    await recordSprite(rootDir, collection, { sprite: false });
    return;
  }

  const built: BuiltIcon[] = [...store.entries()].map(([name, entry]) => ({
    name,
    data: entry.data as IconEntry,
  }));

  const assetContent = renderSpriteAsset(collection, built);
  warnIfSpriteAssetIsLarge(logger, collection, built, assetContent);
  await recordSprite(rootDir, collection, {
    sprite: true,
    hash: spriteAssetId(built),
    assetContent,
  });
}
