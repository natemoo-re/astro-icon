import type { IconEntry } from "../../typings/types";

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

function isTruthyAriaHidden(value: unknown): boolean {
  return value === true || value === "true";
}

function normalizeAccessibleElement(
  input: string | AccessibleElementInput | undefined,
): AccessibleElementInput | undefined {
  if (input == null) return undefined;
  return typeof input === "string" ? { value: input } : input;
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

  const hasOwnName = props["aria-label"] != null || props["aria-labelledby"] != null;
  const hasOwnDesc = props["aria-description"] != null || props["aria-describedby"] != null;
  const isLabeled = Boolean(
    normalizedTitle || normalizedDesc || hasOwnName || hasOwnDesc || props.role != null,
  );

  const titleId = normalizedTitle && !hasOwnName ? (normalizedTitle.id ?? shortId("title")) : undefined;
  const descId = normalizedDesc && !hasOwnDesc ? (normalizedDesc.id ?? shortId("desc")) : undefined;

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
    if (isLabeled && isTruthyAriaHidden(props["aria-hidden"])) {
      console.warn(
        `[astro-icon] This icon has an accessible name or description (title, desc, aria-label, aria-labelledby, aria-description, or aria-describedby) but is also "aria-hidden": it will stay invisible to assistive tech despite being labeled. Remove "aria-hidden", or remove the labeling if this icon is meant to be purely decorative.`,
      );
    }
  }

  return {
    a11yProps: {
      focusable: "false",
      ...(isLabeled
        ? {
            role: "img" as const,
            ...(titleId ? { "aria-labelledby": titleId } : {}),
            ...(descId ? { "aria-describedby": descId } : {}),
          }
        : { "aria-hidden": "true" as const }),
    },
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

/** Builds the final `<svg>` props for a single icon occurrence. Shared by `<Icon>` and `<LiveIcon>`. */
export function renderableIconProps<
  P extends { size?: number | string; width?: unknown; height?: unknown; viewBox?: unknown },
>(
  entry: Pick<IconEntry, "width" | "height" | "viewBox">,
  props: P,
): RenderableIconProps<P> {
  const { size, ...rest } = props;
  const sized = size ? { ...rest, width: size, height: size } : rest;
  return {
    normalizedProps: {
      width: entry.width,
      height: entry.height,
      viewBox: entry.viewBox,
      ...sized,
    } as Omit<P, "size">,
  };
}
