import type { AstroIntegrationLogger } from "astro";
import { AstroIconError } from "../internal/error.js";
import { consoleLogger } from "./logger.js";
import type { IconSource, IconSourceWatcher } from "./source.js";

/**
 * An `IconSource` composed from an ordered list of member sources, tried in
 * turn per icon (first match wins); `getVersion()` only reports a value if
 * every member does. Structurally identical to a plain `IconSource` - the
 * ordering/fallback/aggregation contract is behavioral, not a distinct shape.
 */
export type CompositeSource = IconSource;

/**
 * Normalizes one-or-more `IconSource`s into a single `CompositeSource`, trying each in order per
 * icon (first match wins).
 *
 * `logger` has no bearing on `getIcon`'s own success/failure - it only receives a debug line each
 * time one member fails and execution falls through to the next. Defaults to `consoleLogger`,
 * like `iconifyLocalSource`/`iconifyApiSource`, since `mergeSources` is normally called while
 * building `content.config.ts`'s collections - before Astro hands a loader its own
 * `AstroIntegrationLogger` - so there's no real logger in scope at the call site to pass in.
 */
export function mergeSources(
  sources: IconSource | IconSource[],
  logger: Pick<AstroIntegrationLogger, "debug"> = consoleLogger,
): CompositeSource {
  if (!Array.isArray(sources)) return sources;
  if (sources.length === 1) return sources[0];

  const name = sources.map((source) => source.name).join("+");

  return {
    name,
    async getIcon(iconName) {
      const failures: string[] = [];
      for (const [index, source] of sources.entries()) {
        try {
          return await source.getIcon(iconName);
        } catch (ex) {
          const detail = ex instanceof Error ? ex.message : String(ex);
          failures.push(`${source.name}: ${detail}`);
          // Only worth a log when there's actually another source left to try - the last
          // failure is already reflected in the aggregate error thrown below.
          if (index < sources.length - 1) {
            logger.debug(
              `"${source.name}" failed to resolve "${iconName}" (${detail}), falling back to the next source in "${name}".`,
            );
          }
        }
      }
      throw new AstroIconError(
        `No source in "${name}" provided an icon named "${iconName}".`,
        `Check that "${iconName}" is spelled correctly and included in every source's icon list, if one is set.\n\nTried:\n${failures.map((failure) => `  - ${failure}`).join("\n")}`,
      );
    },
    async listIcons() {
      const lists = await Promise.all(
        sources.map((source) =>
          source.listIcons ? source.listIcons().catch(() => []) : [],
        ),
      );
      return [...new Set(lists.flat())];
    },
    async getVersion() {
      // Only meaningful if every merged source can report one.
      const versions = await Promise.all(
        sources.map(
          (source) =>
            source.getVersion?.().catch(() => undefined) ??
            Promise.resolve(undefined),
        ),
      );
      if (versions.some((version) => !version)) return undefined;
      return versions.join("+");
    },
    // Present unconditionally (even if no member implements `watch`) so `createIconLoader`
    // always has one consistent thing to call for a multi-source collection; a member with no
    // `watch` of its own is simply never asked to register anything.
    //
    // Composing two watchable sources (e.g. two `localSource()` directories) watches both - see
    // the name-collision footgun documented on `IconSource.watch`.
    watch(watcher: IconSourceWatcher, report) {
      for (const member of sources) {
        member.watch?.(watcher, report);
      }
    },
    resolveRoot(root: URL) {
      for (const member of sources) {
        member.resolveRoot?.(root);
      }
    },
    async checkPreconditions() {
      const failures: string[] = [];
      for (const source of sources) {
        // No precondition to check for this member at all - same as one succeeding, since
        // there's nothing wrong to report. Matches getIcon's first-match-wins tolerance: the
        // whole point of composing sources is that one of them being unusable isn't fatal.
        if (!source.checkPreconditions) return;
        try {
          await source.checkPreconditions();
          return;
        } catch (ex) {
          failures.push(
            `${source.name}: ${ex instanceof Error ? ex.message : String(ex)}`,
          );
        }
      }
      throw new AstroIconError(
        `No source in "${name}" is usable.`,
        `Tried:\n${failures.map((failure) => `  - ${failure}`).join("\n")}`,
      );
    },
  };
}
