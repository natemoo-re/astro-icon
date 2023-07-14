export const cache = new WeakMap<Request, Map<string, number>>();

export interface CacheKeyFields {
  name: string
  hFlip?: boolean;
  vFlip?: boolean;
  rotate?: number;
}

export function cacheKey(fields: CacheKeyFields) {
  return `${fields.name}:${fields.hFlip}:${fields.vFlip}:${fields.rotate}`
}
