import type { IconEntry } from "../../typings/types";

/** Process-lifetime cache of resolved entries, keyed by `${collection}:${name}`; lives outside `Icon.astro` so it persists across its per-render frontmatter. */
export const entryCache = new Map<string, { data: IconEntry }>();
