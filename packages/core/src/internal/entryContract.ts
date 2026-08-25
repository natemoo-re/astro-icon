import { z } from "astro/zod";
import type { IconEntry } from "../../typings/types";

/**
 * The single decision for which `IconEntry` fields are `<svg>` attributes and which aren't -
 * previously made independently on both sides of the content/render seam (`entryFromSVG`'s
 * `rootAttrOwner`, `renderableIconProps`'s own destructure) and mirrored a third time by
 * `loader.ts`'s hand-written zod schema, enforced only by comments pointing at each other. This
 * is the one place that decision lives now. Lives in `src/internal/` - the one directory
 * genuinely shared by both the content and render contexts (see `CONTEXT.md`); render must not
 * import from `content/` or vice versa, but both may import from here.
 */

/** Non-attribute `IconEntry` fields: never land on the rendered root `<svg>` as attributes. Tied to `IconEntry` via `satisfies`, so removing one of these from the type is a type error here rather than a silent drift. */
export const RESERVED_ENTRY_FIELDS = [
  "body",
  "title",
  "desc",
] as const satisfies readonly (keyof IconEntry)[];

/** `IconEntry` fields that are `<svg>` attributes with their own typed field, rather than falling through the entry's `string | number` catchall - documentary (the zod schema below still declares each by hand, since zod's per-field types can't be generated from a plain tuple), but tied to `IconEntry` the same way. */
export const STRUCTURAL_ENTRY_FIELDS = [
  "viewBox",
  "width",
  "height",
] as const satisfies readonly (keyof IconEntry)[];

type EntryAttrs = { [key: string]: string | number };

/**
 * Which part of the system owns a root `<svg>` attribute decides where it goes, when
 * `entryFromSVG` builds an `IconEntry` from raw markup - this is a partition by ownership, not a
 * skip-list:
 *
 * - `"structure"`: `viewBox`/`width`/`height` are already the entry's typed fields (lifting a
 *   string copy would put the same fact on the entry twice), and `xmlns`/`xmlns:xlink`/`version`
 *   are meaningless on an inline `<svg>` in HTML.
 * - `"component"`: accessibility (`role`, `aria-*`, `focusable`, `tabindex`) is `<Icon>`/
 *   `<LiveIcon>`'s contract - `iconA11yProps` computes it per usage from the caller's `title`/
 *   `desc` props. Entry fields spread *after* those computed props, so lifting a file's
 *   boilerplate copy (e.g. an export tool's blanket `aria-hidden="true"`) would silently defeat
 *   them: a labeled icon would stay invisible to assistive tech.
 * - `"entry"`: everything else is the author's presentation intent (`fill`, `stroke`, `class`,
 *   `style`, ...), lifted onto the entry as defaults the caller's own props override.
 */
const STRUCTURAL_ROOT_ATTRS = new Set([
  "xmlns",
  "xmlns:xlink",
  "version",
  "viewbox",
  "width",
  "height",
]);
const A11Y_ROOT_ATTRS = new Set(["role", "focusable", "tabindex"]);

export function rootAttrOwner(
  name: string,
): "structure" | "component" | "entry" {
  const lower = name.toLowerCase();
  if (STRUCTURAL_ROOT_ATTRS.has(lower)) return "structure";
  if (A11Y_ROOT_ATTRS.has(lower) || lower.startsWith("aria-")) {
    return "component";
  }
  return "entry";
}

const RESERVED_FIELD_SET: ReadonlySet<string> = new Set(RESERVED_ENTRY_FIELDS);

/** An `IconEntry` split along the reserved/attribute line: `body`/`title`/`desc` pulled out, everything else (the typed structural fields plus any presentation attributes) left as `attrs` for spreading onto the rendered `<svg>`. */
export function splitEntryAttrs(entry: IconEntry): {
  body: string;
  title: string | undefined;
  desc: string | undefined;
  attrs: EntryAttrs;
} {
  const attrs: EntryAttrs = {};
  for (const [key, value] of Object.entries(entry)) {
    if (value === undefined || RESERVED_FIELD_SET.has(key)) continue;
    attrs[key] = value;
  }
  return {
    body: entry.body,
    title: entry.title,
    desc: entry.desc,
    attrs,
  };
}

/** Default schema for an `IconEntry`, overridable via `defineCollection({ loader, schema })`. */
export const iconEntrySchema = z
  .object({
    body: z.string(),
    viewBox: z.string(),
    width: z.number(),
    height: z.number(),
  })
  .catchall(z.union([z.string(), z.number()]));
