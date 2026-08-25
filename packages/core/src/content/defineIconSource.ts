import type { IconSource } from "./source.js";

/**
 * Defines a custom {@link IconSource} with full type inference and checking, without annotating
 * the variable - the same convention as Astro's own `defineConfig`/`defineCollection`:
 *
 * ```ts
 * import { defineIconSource, entryFromSVG } from "astro-icon/source";
 *
 * export const figmaIcons = defineIconSource({
 *   name: "figma",
 *   async getIcons(names) {
 *     // fetch each name, build entries via entryFromSVG(...)
 *   },
 * });
 * ```
 *
 * An identity function at runtime; every method's parameter and return types are inferred from
 * the `IconSource` contract.
 */
export function defineIconSource<T extends IconSource>(source: T): T {
  return source;
}
