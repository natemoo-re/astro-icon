import type { SSRResult } from 'astro/dist/types/@types/astro'
const AstroIcon = Symbol("AstroIcon");

interface AstroIconSSRResult extends SSRResult {
  [AstroIcon]: {
    sprites: Set<string>
  },
}

declare global {
  var $$result: AstroIconSSRResult
}

export function trackSprite(result: AstroIconSSRResult, name: string) {
  if (typeof result[AstroIcon] !== "undefined") {
    result[AstroIcon]["sprites"].add(name);
  } else {
    result[AstroIcon] = {
      sprites: new Set([name]),
    };
  }
}

const warned = new Set();
export async function getUsedSprites(result: AstroIconSSRResult) {
  if (typeof result[AstroIcon] !== "undefined") {
    return Array.from(result[AstroIcon]["sprites"]);
  }
  const pathname = result._metadata.pathname;
  if (!warned.has(pathname)) {
    console.log(`[astro-icon] No sprites found while rendering "${pathname}"`);
    warned.add(pathname);
  }
  return [];
}
