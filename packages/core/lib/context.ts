const AstroIcon = Symbol("AstroIcon");

export function trackSprite(result: any, name: string) {
  if (typeof result[AstroIcon] !== "undefined") {
    result[AstroIcon].add(name);
  } else {
    result[AstroIcon] = new Set([name]);
  }
}

export function getUsedSprites(result: any) {
  if (typeof result[AstroIcon] !== "undefined") {
    return Array.from(result[AstroIcon]);
  }
  throw new Error(
    `[astro-icon] <SpriteSheet> should be the very last child of the page's <body>!\nIs it currently placed before any <Sprite> components?`
  );
}
