export interface IconA11yProps {
  role?: "img";
  "aria-hidden"?: "true";
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  focusable: "false";
}

export interface IconA11yResult {
  /**
   * Attributes to spread onto the rendered `<svg>` *before* the caller's own
   * props, so anything they explicitly set - `role`, `aria-hidden`,
   * `aria-label`, `aria-labelledby`, `aria-description`, `aria-describedby`,
   * `focusable` - always wins over what's computed here.
   */
  a11yProps: IconA11yProps;
  /** The id for `<title>`, or `undefined` to omit it entirely. */
  titleId: string | undefined;
  /** The id for `<desc>`, or `undefined` to omit it entirely. */
  descId: string | undefined;
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

/**
 * Computes the accessibility attributes for a rendered icon `<svg>`, and the
 * ids (if any) for its `<title>`/`<desc>`. Shared by `<Icon>` and `<LiveIcon>`.
 *
 * Decorative by default (`aria-hidden="true" focusable="false"`) - the
 * common case, since most icons sit next to visible text or inside an
 * already-labeled control (a button with its own `aria-label`), where the
 * icon itself should be invisible to assistive tech rather than announced
 * redundantly. Providing `title`, `desc`, or any of
 * `aria-label`/`aria-labelledby`/`aria-description`/`aria-describedby`/
 * `role` opts an icon out of that default into a labeled, standalone
 * graphic (`role="img"`, plus `aria-labelledby`/`aria-describedby`
 * generated to point at `title`/`desc`, unless the caller already owns
 * naming/describing it themselves).
 *
 * The escape hatch is just passing the attribute yourself - every computed
 * value here is meant to be overridden by spreading the caller's own props
 * afterward, not a separate opt-out API.
 */
export function iconA11yProps(
  title: string | undefined,
  desc: string | undefined,
  props: IconA11yInputProps,
): IconA11yResult {
  const hasOwnName = props["aria-label"] != null || props["aria-labelledby"] != null;
  const hasOwnDesc = props["aria-description"] != null || props["aria-describedby"] != null;
  const isLabeled = Boolean(title || desc || hasOwnName || hasOwnDesc || props.role != null);

  const titleId = title && !hasOwnName ? shortId("title") : undefined;
  const descId = desc && !hasOwnDesc ? shortId("desc") : undefined;

  if (import.meta.env.DEV) {
    if (title && hasOwnName) {
      console.warn(
        `[astro-icon] Received both "title" and an explicit "aria-label"/"aria-labelledby" - "title" won't be linked to anything, so it's omitted. Remove "title", or remove your own aria-label/aria-labelledby to let astro-icon wire it up automatically.`,
      );
    }
    if (desc && hasOwnDesc) {
      console.warn(
        `[astro-icon] Received both "desc" and an explicit "aria-description"/"aria-describedby" - "desc" won't be linked to anything, so it's omitted. Remove "desc", or remove your own aria-description/aria-describedby to let astro-icon wire it up automatically.`,
      );
    }
    if (isLabeled && isTruthyAriaHidden(props["aria-hidden"])) {
      console.warn(
        `[astro-icon] This icon has an accessible name or description (title, desc, aria-label, aria-labelledby, aria-description, or aria-describedby) but is also "aria-hidden" - it will stay invisible to assistive tech despite being labeled. Remove "aria-hidden", or remove the labeling if this icon is meant to be purely decorative.`,
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
  };
}
