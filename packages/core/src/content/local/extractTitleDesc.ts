const TITLE_RE = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i;
const DESC_RE = /<desc\b[^>]*>([\s\S]*?)<\/desc\s*>/i;

export interface ExtractedTitleDesc {
  /** The icon's own `<title>` text, if it had one - a default for the `title` prop, not a mutation. */
  title?: string;
  /** The icon's own `<desc>` text, if it had one - a default for the `desc` prop, not a mutation. */
  desc?: string;
  /** `body` with that `<title>`/`<desc>` removed, so a caller-supplied `title`/`desc` prop doesn't end up rendered twice. */
  body: string;
}

/**
 * Pulls a local icon's own inline `<title>`/`<desc>` (if any) out of its body. `<Icon>`/`<LiveIcon>`
 * use the result as the icon's *default* `title`/`desc` prop value, honored only when the caller
 * doesn't pass their own - the same override relationship every other prop already has. Removing
 * them from `body` itself, rather than leaving them in place, avoids two problems a plain
 * extraction wouldn't: a caller who does pass their own `title` would otherwise get a second,
 * untouched `<title>` rendered alongside the one `<Icon>` builds (only the first is treated as the
 * accessible name/native tooltip, so the second is just dead weight); and a decorative icon (no
 * `title` passed, `aria-hidden="true"`) would still show the source's own `<title>` as a native
 * hover tooltip, since `aria-hidden` only affects the accessibility tree, not that behavior.
 */
export function extractTitleDesc(body: string): ExtractedTitleDesc {
  let title: string | undefined;
  let desc: string | undefined;

  const withoutTitle = body.replace(TITLE_RE, (_match, inner: string) => {
    title = inner.trim() || undefined;
    return "";
  });
  const withoutDesc = withoutTitle.replace(DESC_RE, (_match, inner: string) => {
    desc = inner.trim() || undefined;
    return "";
  });

  return { title, desc, body: withoutDesc.trim() };
}
