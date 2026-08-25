import type { HTMLAttributes } from "astro/types";
import { splitEntryAttrs } from "../internal/entryContract.js";
import type { IconEntry } from "../../typings/types";
import type { IconName, LiveCollectionName } from "../../typings/names";

export interface IconA11yProps {
  role?: "img";
  "aria-hidden"?: "true";
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  focusable: "false";
}

/**
 * The object form of `title`/`desc`, for callers that need a stable, known
 * id on the generated `<title>`/`<desc>` — e.g. so a wrapping element's own
 * `aria-labelledby` can reference the icon's title without duplicating the
 * text. Doesn't change how the icon labels *itself*: that's still wired up
 * automatically via separate `aria-labelledby`/`aria-describedby`.
 */
export interface AccessibleElementInput {
  /** Overrides the id astro-icon would otherwise generate. */
  id?: string;
  value: string;
}

/**
 * The props `<Icon>` and `<LiveIcon>` both take, declared once so the two can't document
 * different semantics for the same prop. Each component adds only how its icon is *addressed*
 * (`name` vs. `collection`/`icon`); everything a caller can say about how the icon *renders*
 * lives here, alongside the `HTMLAttributes<"svg">` both also extend.
 *
 * The decorative/labeled distinction this encodes: an icon is decorative by default
 * (`aria-hidden`, invisible to assistive tech), and passing `title`/`desc` - or any of
 * `aria-label`/`aria-labelledby`/`aria-description`/`aria-describedby` - opts it into being a
 * labeled, standalone graphic. It's a runtime distinction, not a structural one (the same props
 * type describes both), so `iconA11yProps` is where it's actually decided.
 */
export interface SharedIconProps {
  /**
   * Adds an accessible `<title>` before the icon body, and takes the icon out
   * of its decorative default. Pass `{ id, value }` instead of a plain string
   * to control the `<title>`'s id, e.g. so something outside the icon can
   * reference it directly.
   */
  title?: string | AccessibleElementInput;
  /**
   * Adds an accessible `<desc>` after `title`, and takes the icon out of its
   * decorative default. Pass `{ id, value }` instead of a plain string to
   * control the `<desc>`'s id, e.g. so something outside the icon can
   * reference it directly.
   */
  desc?: string | AccessibleElementInput;
  /**
   * Sets the icon's accessible description inline, without a separate
   * `<desc>` element to reference. Same relationship to `aria-describedby`
   * as `aria-label` has to `aria-labelledby`.
   *
   * This is a WAI-ARIA 1.3 attribute that Astro's `HTMLAttributes` type
   * doesn't include yet, so it's declared here explicitly.
   */
  "aria-description"?: string;
  /** Sets both `width` and `height` at once. Takes priority over either if both are set. */
  size?: number | string;
  /** The icon's rendered width; defaults to the source SVG's own width. Pass `null` to omit the attribute entirely, e.g. to size the icon from CSS instead. */
  width?: number | string | null;
  /** The icon's rendered height; defaults to the source SVG's own height. Pass `null` to omit the attribute entirely, e.g. to size the icon from CSS instead. */
  height?: number | string | null;
}

/**
 * `<Icon>`'s full props. Exported (from `astro-icon/components` and the root `astro-icon`) so a
 * wrapper component can extend or pick from it without re-declaring the icon surface:
 *
 * ```astro
 * ---
 * import type { IconProps } from "astro-icon/components";
 * interface Props extends IconProps { variant?: "solid" | "outline" }
 * ---
 * ```
 */
export interface IconProps extends HTMLAttributes<"svg">, SharedIconProps {
  /** `"collection:icon"`, or a bare icon name if you have a collection named `icons`. */
  name: IconName;
}

/** `<LiveIcon>`'s full props - the live counterpart to {@link IconProps}. */
export interface LiveIconProps extends HTMLAttributes<"svg">, SharedIconProps {
  /** The live collection to resolve `icon` from; live collections have no default, unlike `<Icon>`. */
  collection: LiveCollectionName;
  /**
   * The icon's name within `collection`. Always a plain `string`: live
   * collections resolve per-request, so the exact value is often only known
   * at runtime (e.g. a user-driven search) and can't be checked at sync time.
   */
  icon: string;
}

export interface IconA11yResult {
  /**
   * Attributes to spread onto the rendered `<svg>` *before* the caller's own
   * props, so anything they explicitly set (`role`, `aria-hidden`,
   * `aria-label`, `aria-labelledby`, `aria-description`, `aria-describedby`,
   * `focusable`) always wins over what's computed here.
   */
  a11yProps: IconA11yProps;
  /** The id for `<title>`, or `undefined` to omit it entirely. */
  titleId: string | undefined;
  /** The id for `<desc>`, or `undefined` to omit it entirely. */
  descId: string | undefined;
  /** The resolved `<title>` text, unwrapped from the `{ id, value }` form if used. */
  titleText: string | undefined;
  /** The resolved `<desc>` text, unwrapped from the `{ id, value }` form if used. */
  descText: string | undefined;
}

interface IconA11yInputProps {
  role?: unknown;
  "aria-hidden"?: unknown;
  "aria-label"?: unknown;
  "aria-labelledby"?: unknown;
  "aria-description"?: unknown;
  "aria-describedby"?: unknown;
}

function shortId(kind: "title" | "desc"): string {
  return `astro-icon-${kind}-${crypto.randomUUID().slice(0, 8)}`;
}

function normalizeAccessibleElement(
  input: string | AccessibleElementInput | undefined,
): AccessibleElementInput | undefined {
  if (input == null) return undefined;
  return input instanceof Object ? input : { value: input };
}

/**
 * Computes the accessibility attributes for a rendered icon `<svg>`, and the
 * ids (if any) for its `<title>`/`<desc>`. Shared by `<Icon>` and `<LiveIcon>`.
 *
 * Decorative by default (`aria-hidden="true" focusable="false"`), since most
 * icons sit next to visible text or inside an already-labeled control, where
 * the icon itself should stay invisible to assistive tech rather than get
 * announced redundantly.
 *
 * Providing `title`, `desc`, or any of
 * `aria-label`/`aria-labelledby`/`aria-description`/`aria-describedby`/`role`
 * opts an icon out of that default into a labeled, standalone graphic
 * (`role="img"`, plus `aria-labelledby`/`aria-describedby` generated to point
 * at `title`/`desc`, unless the caller already owns naming or describing it).
 *
 * There's no separate opt-out API: every value computed here is meant to be
 * overridden by spreading the caller's own props afterward.
 */
export function iconA11yProps(
  title: string | AccessibleElementInput | undefined,
  desc: string | AccessibleElementInput | undefined,
  props: IconA11yInputProps,
): IconA11yResult {
  const normalizedTitle = normalizeAccessibleElement(title);
  const normalizedDesc = normalizeAccessibleElement(desc);

  const hasOwnName =
    props["aria-label"] != null || props["aria-labelledby"] != null;
  const hasOwnDesc =
    props["aria-description"] != null || props["aria-describedby"] != null;
  const isLabeled = Boolean(
    normalizedTitle ||
    normalizedDesc ||
    hasOwnName ||
    hasOwnDesc ||
    props.role != null,
  );

  const titleId =
    normalizedTitle && !hasOwnName
      ? (normalizedTitle.id ?? shortId("title"))
      : undefined;
  const descId =
    normalizedDesc && !hasOwnDesc
      ? (normalizedDesc.id ?? shortId("desc"))
      : undefined;

  if (import.meta.env.DEV) {
    if (normalizedTitle && hasOwnName) {
      console.warn(
        `[astro-icon] Received both "title" and an explicit "aria-label"/"aria-labelledby": "title" won't be linked to anything, so it's omitted. Remove "title", or remove your own aria-label/aria-labelledby to let astro-icon wire it up automatically.`,
      );
    }
    if (normalizedDesc && hasOwnDesc) {
      console.warn(
        `[astro-icon] Received both "desc" and an explicit "aria-description"/"aria-describedby": "desc" won't be linked to anything, so it's omitted. Remove "desc", or remove your own aria-description/aria-describedby to let astro-icon wire it up automatically.`,
      );
    }
    const ariaHidden = props["aria-hidden"];
    if (isLabeled && (ariaHidden === true || ariaHidden === "true")) {
      console.warn(
        `[astro-icon] This icon has an accessible name or description (title, desc, aria-label, aria-labelledby, aria-description, or aria-describedby) but is also "aria-hidden": it will stay invisible to assistive tech despite being labeled. Remove "aria-hidden", or remove the labeling if this icon is meant to be purely decorative.`,
      );
    }
  }

  const a11yProps: IconA11yProps = { focusable: "false" };
  if (isLabeled) {
    a11yProps.role = "img";
    if (titleId) a11yProps["aria-labelledby"] = titleId;
    if (descId) a11yProps["aria-describedby"] = descId;
  } else {
    a11yProps["aria-hidden"] = "true";
  }

  return {
    a11yProps,
    titleId,
    descId,
    titleText: normalizedTitle?.value,
    descText: normalizedDesc?.value,
  };
}

export interface RenderableIconProps<P> {
  /** Props to spread onto the rendered `<svg>`, with `size` folded into `width`/`height`. */
  normalizedProps: Omit<P, "size">;
}

/**
 * Builds the final `<svg>` props for a single icon occurrence. Shared by `<Icon>` and `<LiveIcon>`.
 *
 * Spreads the whole entry (minus `body`/`title`/`desc`, which aren't `<svg>` attributes - see
 * `splitEntryAttrs` in `src/internal/entryContract.ts` for the authoritative reserved/attribute
 * line) as defaults, not just `width`/`height`/`viewBox`: a local icon's own root-tag attributes
 * (`fill`/`stroke`/`class`/... - see `entryFromSVG`) land here too, so a caller's own prop for
 * the same attribute genuinely overrides it by landing on the same element, rather than losing to
 * an inner element's own value the way baking them into `body` would.
 */
export function renderableIconProps<
  P extends {
    size?: number | string;
    width?: unknown;
    height?: unknown;
    viewBox?: unknown;
  },
>(entry: IconEntry, props: P): RenderableIconProps<P> {
  const { attrs: entryAttrs } = splitEntryAttrs(entry);
  const { size, ...rest } = props;
  const sized = size ? { ...rest, width: size, height: size } : rest;
  return {
    normalizedProps: {
      ...entryAttrs,
      ...sized,
    } as Omit<P, "size">,
  };
}
