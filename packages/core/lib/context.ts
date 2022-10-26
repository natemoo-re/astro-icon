interface AstroRequest extends Request {}

const sprites = new WeakMap<AstroRequest, Set<string>>();

export function trackSprite(request: AstroRequest, name: string): void {
  let currentSet = sprites.get(request);
  if (!currentSet) {
    currentSet = new Set([name]);
  } else {
    currentSet.add(name);
  }
  sprites.set(request, currentSet);
}

const warned = new Set();
export async function getUsedSprites(request: AstroRequest): Promise<string[]> {
  const currentSet = sprites.get(request);
  if (currentSet) {
    return Array.from(currentSet);
  }
  if (!warned.has(request)) {
    const { pathname } = new URL(request.url);
    console.log(`[astro-icon] No sprites found while rendering "${pathname}"`);
    warned.add(request);
  }
  return [];
}
