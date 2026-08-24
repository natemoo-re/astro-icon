import type { AstroIntegrationLogger } from "astro";
import { AstroIconError } from "../internal/error.js";
import { consoleLogger } from "./logger.js";
import type { IconSource, IconSourceWatcher } from "./source.js";
import type { IconEntry } from "../../typings/types";

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
 * `logger` has no bearing on `getIcons`'s own success/failure - it receives a debug line each
 * time one member fails to resolve a name and execution falls through to the next member for
 * that name, and a warning for each member that fails `checkPreconditions()` without making the
 * whole composite unusable. Defaults to `consoleLogger`, like
 * `iconifyLocalSource`/`iconifyApiSource`, since `mergeSources` is normally called while building
 * `content.config.ts`'s collections - before Astro hands a loader its own
 * `AstroIntegrationLogger`.
 */
export function mergeSources(
  sources: IconSource | IconSource[],
  logger: Pick<AstroIntegrationLogger, "debug" | "warn"> = consoleLogger,
): CompositeSource {
  if (!Array.isArray(sources)) return sources;
  if (sources.length === 1) return sources[0];

  const name = sources.map((source) => source.name).join("+");

  return {
    name,
    // Tries each member in turn, but per *batch*, not per name: the first member gets the whole
    // `names` list in one `getIcons` call (so a batching member - `iconifyApiSource` - still gets
    // to fetch everything it can in one request), and only the names it didn't resolve carry over
    // to the next member's call. First-match-wins is preserved per name; batching is preserved
    // per member.
    async getIcons(names) {
      const result = new Map<string, IconEntry | Error>();
      const failures = new Map<string, string[]>();
      let remaining = names;

      for (const [index, source] of sources.entries()) {
        if (remaining.length === 0) break;
        const memberResult = await source.getIcons(remaining);
        const stillRemaining: string[] = [];
        for (const iconName of remaining) {
          const entry = memberResult.get(iconName);
          if (entry && !(entry instanceof Error)) {
            result.set(iconName, entry);
            continue;
          }
          const detail =
            entry instanceof Error ? entry.message : "didn't resolve";
          const tried = failures.get(iconName) ?? [];
          tried.push(`${source.name}: ${detail}`);
          failures.set(iconName, tried);
          stillRemaining.push(iconName);
          // Only worth a log when there's actually another source left to try - a name still
          // unresolved after the last member is already reflected in the aggregate error below.
          if (index < sources.length - 1) {
            logger.debug(
              `"${source.name}" failed to resolve "${iconName}" (${detail}), falling back to the next source in "${name}".`,
            );
          }
        }
        remaining = stillRemaining;
      }

      for (const iconName of remaining) {
        const tried = failures.get(iconName) ?? [];
        result.set(
          iconName,
          new AstroIconError(
            `No source in "${name}" provided an icon named "${iconName}".`,
            `Check that "${iconName}" is spelled correctly and included in every source's icon list, if one is set.\n\nTried:\n${tried.map((failure) => `  - ${failure}`).join("\n")}`,
          ),
        );
      }
      return result;
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
    // Checks every member, not just up to the first usable one: a broken member is worth knowing
    // about even when another member covers for it, and it may be the only one holding icons a
    // later `getIcons` call actually needs. Fatal only when no member is usable at all - the
    // whole point of composing sources is that one of them being unusable isn't fatal - with
    // partial failures downgraded to a warning each.
    async checkPreconditions() {
      const failures: string[] = [];
      let usable = false;
      for (const source of sources) {
        // No precondition to check for this member - same as it passing, since there's nothing
        // wrong to report.
        if (!source.checkPreconditions) {
          usable = true;
          continue;
        }
        try {
          await source.checkPreconditions();
          usable = true;
        } catch (ex) {
          failures.push(
            `${source.name}: ${ex instanceof Error ? ex.message : String(ex)}`,
          );
        }
      }
      if (!usable) {
        throw new AstroIconError(
          `No source in "${name}" is usable.`,
          `Tried:\n${failures.map((failure) => `  - ${failure}`).join("\n")}`,
        );
      }
      for (const failure of failures) {
        logger.warn(
          `A source in "${name}" isn't usable (${failure}); its icons will only resolve if another source provides them.`,
        );
      }
    },
  };
}
