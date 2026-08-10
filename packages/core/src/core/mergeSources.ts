import { AstroIconError } from "./AstroIconError.js";
import type { IconSource } from "./iconSource.js";

/** Normalizes one-or-more `IconSource`s into a single one, trying each in order per icon (first match wins). */
export function mergeSources(sources: IconSource | IconSource[]): IconSource {
  if (!Array.isArray(sources)) return sources;
  if (sources.length === 1) return sources[0];

  const name = sources.map((source) => source.name).join("+");

  return {
    name,
    async getIcon(iconName) {
      for (const source of sources) {
        try {
          return await source.getIcon(iconName);
        } catch {
          // Try the next source; only fail if none of them have it.
        }
      }
      throw new AstroIconError(
        `No source in "${name}" provided an icon named "${iconName}" (tried: ${sources.map((source) => source.name).join(", ")}).`,
        `Check that "${iconName}" is spelled correctly and included in every source's icon list, if one is set.`,
      );
    },
    async listIcons() {
      const lists = await Promise.all(
        sources.map((source) => (source.listIcons ? source.listIcons().catch(() => []) : [])),
      );
      return [...new Set(lists.flat())];
    },
    async getVersion() {
      // Only meaningful if every merged source can report one.
      const versions = await Promise.all(
        sources.map((source) => source.getVersion?.().catch(() => undefined) ?? Promise.resolve(undefined)),
      );
      if (versions.some((version) => !version)) return undefined;
      return versions.join("+");
    },
  };
}
