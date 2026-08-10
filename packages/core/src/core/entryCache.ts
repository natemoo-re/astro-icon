import type { IconEntry } from "../../typings/types";

/**
 * Module-level (process-lifetime) cache of resolved content-store entries,
 * keyed by `${collection}:${name}`. `Icon.astro`'s frontmatter re-runs on
 * every render, so a `Map` declared there is a fresh empty map each time -
 * this has to live in its own module to actually persist across renders,
 * the same way `createLiveIconLoader`'s cache does.
 */
export const entryCache = new Map<string, { data: IconEntry }>();
