import { execFile } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const run = promisify(execFile);

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const fixtureRoot = join(packageRoot, "test/fixtures/basic");
const astroBin = join(packageRoot, "node_modules/.bin/astro");

describe("createIconLoader(iconifyLocalSource()) + <Icon> against a real astro build", () => {
  let html = "";
  let iconsTypes = "";
  let spinnersTypes = "";
  let index = "";

  beforeAll(async () => {
    await run(astroBin, ["build", "--root", fixtureRoot], {
      cwd: packageRoot,
    });
    html = await readFile(join(fixtureRoot, "dist/index.html"), "utf-8");
    index = await readFile(
      join(fixtureRoot, ".astro/astro-icon.d.ts"),
      "utf-8",
    );
    iconsTypes = await readFile(
      join(fixtureRoot, ".astro/astro-icon/build-icons.d.ts"),
      "utf-8",
    );
    spinnersTypes = await readFile(
      join(fixtureRoot, ".astro/astro-icon/build-spinners.d.ts"),
      "utf-8",
    );
  }, 60_000);

  afterAll(async () => {
    await rm(join(fixtureRoot, "dist"), { recursive: true, force: true });
    await rm(join(fixtureRoot, ".astro"), { recursive: true, force: true });
  });

  it("resolves a bare name against the 'icons' collection", () => {
    expect(html).toContain('data-icon="3-dots-fade"');
  });

  it("resolves a collection:name against the collection named literally", () => {
    expect(html).toContain('data-icon="spinners:3-dots-fade"');
  });

  it("renders a viewBox on every icon occurrence", () => {
    expect(html.match(/viewBox="0 0 24 24"/g)?.length).toBeGreaterThanOrEqual(
      5,
    );
  });

  it("renders every occurrence of a repeated icon fully inline, no symbol/use", () => {
    const inlineCount = (
      html.match(/<circle cx="4" cy="12" r="3" fill="currentColor">/g) ?? []
    ).length;
    expect(inlineCount).toBeGreaterThanOrEqual(3);
    expect(html).not.toContain("<symbol");
    expect(html).not.toContain("<use ");
  });

  it("gives each occurrence of a repeated icon distinct internal ids, so <animate> timing refs don't cross-reference another instance", () => {
    // "3-dots-fade"/"spinners:3-dots-fade" bodies carry internal <animate id="...">
    // elements referenced by sibling begin="id.end"/"id.begin" timing chains -
    // colliding ids across occurrences would desync the wrong instances.
    const svgBlocks =
      html.match(
        /<svg[^>]*data-icon="(?:3-dots-fade|spinners:3-dots-fade)"[^>]*>[\s\S]*?<\/svg>/g,
      ) ?? [];
    expect(svgBlocks.length).toBeGreaterThanOrEqual(4);

    const allIds = svgBlocks.flatMap((block) =>
      [...block.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]),
    );
    expect(new Set(allIds).size).toBe(allIds.length);

    for (const block of svgBlocks) {
      const ids = new Set(
        [...block.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]),
      );
      const refs = [...block.matchAll(/([\w-]+)\.(?:begin|end)/g)].map(
        (m) => m[1],
      );
      expect(refs.length).toBeGreaterThan(0);
      for (const ref of refs) {
        expect(ids.has(ref)).toBe(true);
      }
    }
  });

  it("auto-scans usage to decide what's *loaded*, without limiting what's *typed*", () => {
    // The "icons" collection (`createIconLoader(iconifyLocalSource("svg-spinners"))`, no `icons` option)
    // only has one name ever referenced on the page - but svg-spinners is
    // installed locally, so the generated types should still offer the
    // whole pack for autocomplete, not just the one icon actually used.
    expect(iconsTypes).toContain('"icons":');
    expect(iconsTypes).toContain('"3-dots-fade"');
    expect(iconsTypes).toContain('"180-ring"');
  });

  it("types the explicit `icons` subset as-is for a collection that set one", () => {
    // The "spinners" collection is explicitly scoped to one icon - typed
    // the same as what's loaded, since that's all the user asked for.
    expect(spinnersTypes).toContain('"spinners": "3-dots-fade";');
  });

  it("indexes every collection's declaration file", () => {
    expect(index).toContain('reference path="./astro-icon/build-icons.d.ts"');
    expect(index).toContain(
      'reference path="./astro-icon/build-spinners.d.ts"',
    );
  });

  it("renders icons combined from multiple sources (createIconLoader + a custom IconSource) into one collection", () => {
    expect(html).toContain('data-icon="combined:180-ring"');
    expect(html).toContain('data-icon="combined:custom-square"');
    expect(html).toContain('<rect x="4" y="4" width="16" height="16"/>');
  });

  it("preserves a license comment from a local .svg file's own markup (#177)", () => {
    expect(html).toContain('data-icon="local:licensed"');
    expect(html).toContain(
      "<!-- Font Awesome Free 6.4.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free (Icons: CC BY 4.0) -->",
    );
  });

  it("defaults to a local icon's own inline <title>/<desc> when the caller passes neither", () => {
    const svgBlocks =
      html.match(/<svg[^>]*data-icon="local:titled"[^>]*>[\s\S]*?<\/svg>/g) ??
      [];
    expect(svgBlocks).toHaveLength(2);

    const [defaulted] = svgBlocks;
    expect(defaulted).toContain('role="img"');
    expect(defaulted).toMatch(/<title id="[^"]+">Titled Icon<\/title>/);
    expect(defaulted).toMatch(
      /<desc id="[^"]+">A titled icon&#39;s description<\/desc>/,
    );
  });

  it("lets a caller-supplied title win, without a duplicate <title> from the source's own", () => {
    const svgBlocks =
      html.match(/<svg[^>]*data-icon="local:titled"[^>]*>[\s\S]*?<\/svg>/g) ??
      [];
    const [, overridden] = svgBlocks;

    expect(overridden).toContain(">Caller Title</title>");
    expect(overridden).not.toContain("Titled Icon");
    expect((overridden.match(/<title/g) ?? []).length).toBe(1);
  });
});
