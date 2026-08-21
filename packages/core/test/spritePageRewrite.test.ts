import { describe, expect, it } from "vitest";
import { rewritePageSprites } from "../src/content/sprite/rewrite.js";

function page(body: string): string {
  return `<!DOCTYPE html><html><head><title>t</title></head><body>${body}</body></html>`;
}

const icon = (extra = "") =>
  `<svg data-icon="mdi:home" viewBox="0 0 24 24" width="24" height="24"${extra}><path d="M0 0"/></svg>`;

describe("rewritePageSprites", () => {
  it("returns html completely unchanged when there's no data-icon at all", () => {
    const html = page("<p>hello</p>");
    expect(rewritePageSprites(html)).toBe(html);
  });

  it("returns html completely unchanged when an icon appears only once - nothing to dedupe", () => {
    const html = page(icon());
    expect(rewritePageSprites(html)).toBe(html);
  });

  it("dedupes an icon repeated twice into one <symbol> plus two <use>s", () => {
    const out = rewritePageSprites(page(icon() + icon()));
    expect(out).toContain(
      '<symbol id="ai-mdi-home" viewBox="0 0 24 24"><path d="M0 0" /></symbol>',
    );
    expect(out.match(/<use href="#ai-mdi-home">/g)).toHaveLength(2);
    // Each instance's own outer <svg ...> attributes survive untouched.
    expect(out).toContain(
      '<svg data-icon="mdi:home" viewBox="0 0 24 24" width="24" height="24">',
    );
  });

  it("places the <symbol> defs block before any <use> that references it", () => {
    const out = rewritePageSprites(page(icon() + icon()));
    expect(out.indexOf("<symbol")).toBeLessThan(out.indexOf("<use"));
  });

  it("normalizes a bare name and a collection:name form of the same icon to one symbol", () => {
    const bare = `<svg data-icon="home" viewBox="0 0 24 24"><path d="M0 0"/></svg>`;
    const prefixed = `<svg data-icon="icons:home" viewBox="0 0 24 24"><path d="M0 0"/></svg>`;
    const out = rewritePageSprites(page(bare + prefixed));
    expect(out.match(/<symbol/g)).toHaveLength(1);
    expect(out).toContain('<use href="#ai-icons-home">');
  });

  it("leaves a single-use icon inline even when other icons on the page get deduped", () => {
    const onceOnly = `<svg data-icon="mdi:search" viewBox="0 0 24 24"><path d="search"/></svg>`;
    const out = rewritePageSprites(page(icon() + icon() + onceOnly));
    expect(out).toContain('<path d="search" />');
    expect(out).not.toContain('<use href="#ai-mdi-search">');
  });

  it("skips an icon marked data-icon-inline, even if its id repeats elsewhere unmarked", () => {
    const inlineOptOut = `<svg data-icon="mdi:home" data-icon-inline viewBox="0 0 24 24"><path d="M0 0"/></svg>`;
    const out = rewritePageSprites(page(icon() + inlineOptOut));
    // Only the un-marked one dedupes into nothing (count of eligible occurrences is 1), so
    // neither should be rewritten - the opted-out one is never a candidate at all.
    expect(out).not.toContain("<symbol");
    expect(out).not.toContain("<use href");
  });

  it("skips <LiveIcon> output (data-icon-live), regardless of how many times its name repeats", () => {
    const live = `<svg data-icon="mdi:home" data-icon-live viewBox="0 0 24 24"><path d="M0 0"/></svg>`;
    const out = rewritePageSprites(page(live + live));
    expect(out).not.toContain("<symbol");
    expect(out).not.toContain("<use href");
  });

  it("preserves each instance's own title/desc instead of folding it into the shared symbol", () => {
    const withTitle = `<svg data-icon="mdi:home" viewBox="0 0 24 24"><title>Home</title><path d="M0 0"/></svg>`;
    const out = rewritePageSprites(page(withTitle + icon()));
    expect(out).toContain('<title>Home</title><use href="#ai-mdi-home">');
    // The symbol itself only carries the shared body, not any instance's title.
    const symbolMatch = out.match(/<symbol[^>]*>(.*?)<\/symbol>/);
    expect(symbolMatch?.[1]).not.toContain("<title>");
  });

  it("never rewrites an icon inside a [data-astro-transition-persist] region, even if repeated elsewhere", () => {
    const persisted = `<div data-astro-transition-persist="x">${icon()}</div>`;
    const out = rewritePageSprites(page(persisted + icon()));
    expect(out).not.toContain("<symbol");
    expect(out).not.toContain("<use href");
    // Both instances still render their full body untouched.
    expect(out.match(/<path d="M0 0"/g)).toHaveLength(2);
  });

  it("keeps a page's doctype and surrounding structure intact", () => {
    const out = rewritePageSprites(page(icon() + icon()));
    expect(out.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(out).toContain("<title>t</title>");
  });

  it("returns the original html unmodified (not even re-serialized) when parsing throws", () => {
    // A string containing "data-icon" that isn't well-formed enough to break something
    // downstream is still handled - the fast path can't distinguish "well-formed but no
    // rewrite needed" from "malformed"; both must be safe.
    const weird = "not really <html data-icon but whatever";
    expect(rewritePageSprites(weird)).toBe(weird);
  });
});
