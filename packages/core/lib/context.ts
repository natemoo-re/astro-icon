const AstroIcon = Symbol("AstroIcon");

export function trackSprite(result: any, name: string) {
  if (typeof result[AstroIcon] !== "undefined") {
    result[AstroIcon]['sprites'].add(name);
  } else {
    result[AstroIcon] = {
      sprites: new Set([name]),
    }
  }
}

export async function getUsedSprites(result: any) {
  if (typeof result[AstroIcon] !== "undefined") {
    return Array.from(result[AstroIcon]['sprites']);
  }
  throw new Error(
    `[astro-icon] <SpriteSheet> should be the very last child of the page's <body>!\nIs it currently placed before any <Sprite> components?`
  );
}
