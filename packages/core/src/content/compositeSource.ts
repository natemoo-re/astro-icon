import { AstroIconError } from "../internal/error.js";
import type { IconSource } from "./source.js";

/**
 * An `IconSource` composed from an ordered list of member sources, tried in
 * turn per icon (first match wins); `getVersion()` only reports a value if
 * every member does. Structurally identical to a plain `IconSource` - the
 * ordering/fallback/aggregation contract is behavioral, not a distinct shape.
 */
export type CompositeSource = IconSource;

/** Normalizes one-or-more `IconSource`s into a single `CompositeSource`, trying each in order per icon (first match wins). */
export function mergeSources(sources: IconSource | IconSource[]): CompositeSource {
  if (!Array.isArray(sources)) return sources;
  if (sources.length === 1) return sources[0];

  const name = sources.map((source) => source.name).join("+");

  return {
    name,
    async getIcon(iconName) {
      const failures: string[] = [];
      for (const source of sources) {
        try {
          return await source.getIcon(iconName);
        } catch (ex) {
          // Try the next source; only fail if none of them have it.
          failures.push(`${source.name}: ${ex instanceof Error ? ex.message : String(ex)}`);
        }
      }
      throw new AstroIconError(
        `No source in "${name}" provided an icon named "${iconName}".`,
        `Check that "${iconName}" is spelled correctly and included in every source's icon list, if one is set.\n\nTried:\n${failures.map((failure) => `  - ${failure}`).join("\n")}`,
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
