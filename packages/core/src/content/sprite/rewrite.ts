import { ELEMENT_NODE, h, parse, renderSync, walkSync } from "ultrahtml";
import type { ElementNode, Node } from "ultrahtml";
import { spriteSymbolId } from "../../internal/spriteManifest.js";
import { parseIconName } from "../../render/parseIconName.js";

const PERSIST_ATTR = "data-astro-transition-persist";

interface Candidate {
  element: ElementNode;
  id: string;
}

/**
 * Rewrites one already-rendered prerendered page: a sprite-eligible icon
 * repeated 2+ times on the page becomes `<use>` against a shared `<symbol>`
 * injected right after `<body>` (before any `<use>` - no forward
 * reference). An icon used once, opted out (`data-icon-inline`),
 * `<LiveIcon>` output (`data-icon-live`), or inside a
 * `[data-astro-transition-persist]` region is left exactly as `<Icon>`
 * rendered it.
 *
 * No new marker needed - eligibility is entirely decided already, by
 * `<Icon>`'s own `data-icon`/`data-icon-inline`/`data-icon-live` output.
 * This only ever runs at build time, against finished HTML files, never
 * against a live response.
 *
 * Returns `html` completely unchanged - not even re-serialized - whenever
 * nothing qualifies or anything unexpected happens while parsing/walking,
 * so a bug here can only ever cost the optimization, never correctness.
 */
export function rewritePageSprites(html: string): string {
  if (!html.includes("data-icon")) return html;

  try {
    const root = parse(html);
    return rewrite(root, html);
  } catch {
    return html;
  }
}

function rewrite(root: Node, original: string): string {
  const candidates: Candidate[] = [];
  const countById = new Map<string, number>();
  let body: ElementNode | undefined;

  walkSync(root, (node) => {
    if (node.type !== ELEMENT_NODE) return;
    const element = node as ElementNode;

    if (element.name === "body" && !body) body = element;
    if (element.name !== "svg") return;

    const dataIcon = element.attributes["data-icon"];
    if (!dataIcon) return;
    if ("data-icon-inline" in element.attributes) return;
    if ("data-icon-live" in element.attributes) return;
    if (isInsidePersistedRegion(element)) return;

    const { collection, name } = parseIconName(dataIcon);
    const id = spriteSymbolId(collection, name);
    candidates.push({ element, id });
    countById.set(id, (countById.get(id) ?? 0) + 1);
  });

  const keep = new Set(
    [...countById.entries()]
      .filter(([, count]) => count >= 2)
      .map(([id]) => id),
  );
  if (keep.size === 0 || !body) return original;

  const symbols = new Map<string, ElementNode>();

  for (const { element, id } of candidates) {
    if (!keep.has(id)) continue;

    if (!symbols.has(id)) {
      // Any occurrence's non-title/desc children are canonical - same source
      // icon, same body, regardless of which instance happened to be walked first.
      const viewBox = element.attributes.viewBox ?? "";
      const iconBody = element.children.filter(
        (child) => !isTitleOrDesc(child),
      );
      symbols.set(id, h("symbol", { id, viewBox }, ...iconBody));
    }

    // Keep this instance's own title/desc (per-instance accessible text), replace the rest.
    const titleDesc = element.children.filter(isTitleOrDesc);
    element.children = [...titleDesc, h("use", { href: `#${id}` })];
  }

  const defs = h(
    "svg",
    {
      style: "position:absolute;width:0;height:0",
      "aria-hidden": "true",
      focusable: "false",
    },
    ...symbols.values(),
  );
  body.children.unshift(defs);

  return renderSync(root);
}

function isTitleOrDesc(node: Node): boolean {
  return (
    node.type === ELEMENT_NODE &&
    ["title", "desc"].includes((node as ElementNode).name)
  );
}

function isInsidePersistedRegion(element: ElementNode): boolean {
  let current: Node | undefined = element.parent;
  while (current) {
    if (
      current.type === ELEMENT_NODE &&
      PERSIST_ATTR in (current as ElementNode).attributes
    ) {
      return true;
    }
    current = current.parent;
  }
  return false;
}
