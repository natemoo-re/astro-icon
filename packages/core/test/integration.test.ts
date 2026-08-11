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

// Populated by the first describe's beforeAll, before its afterAll deletes
// dist/ - the second describe reads this instead of re-reading the file.
let spriteHtml = "";

describe("iconify() + <Icon> against a real astro build", () => {
  let html = "";
  let iconsTypes = "";
  let spinnersTypes = "";
  let index = "";

  beforeAll(async () => {
    await run(astroBin, ["build", "--root", fixtureRoot], {
      cwd: packageRoot,
    });
    html = await readFile(join(fixtureRoot, "dist/index.html"), "utf-8");
    spriteHtml = await readFile(join(fixtureRoot, "dist/sprite/index.html"), "utf-8");
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
    expect(
      html.match(/viewBox="0 0 24 24"/g)?.length,
    ).toBeGreaterThanOrEqual(5);
  });

  it("renders every occurrence of a repeated icon fully inline, no symbol/use", () => {
    const inlineCount = (
      html.match(/<circle cx="4" cy="12" r="3" fill="currentColor">/g) ?? []
    ).length;
    expect(inlineCount).toBeGreaterThanOrEqual(3);
    expect(html).not.toContain("<symbol");
    expect(html).not.toContain("<use ");
  });

  it("auto-scans usage to decide what's *loaded*, without limiting what's *typed*", () => {
    // The "icons" collection (`iconify("svg-spinners")`, no `icons` option)
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
});

describe("<Sprite> against a real astro build", () => {
  it("emits exactly one <symbol> per unique icon inside the Sprite boundary", () => {
    expect((spriteHtml.match(/<symbol id="ai:icons:3-dots-fade"/g) ?? []).length).toBe(1);
    expect((spriteHtml.match(/<symbol id="ai:spinners:3-dots-fade"/g) ?? []).length).toBe(1);
  });

  it("rewrites every occurrence inside the Sprite boundary into a <use>, including ones nested inside another Astro component", () => {
    // 3 direct <Icon> children + 2 rendered inside <IconRow /> (a nested
    // Astro component, not a direct child of <Sprite>) = 5.
    expect((spriteHtml.match(/<use href="#ai:icons:3-dots-fade" \/>/g) ?? []).length).toBe(5);
    expect((spriteHtml.match(/<use href="#ai:spinners:3-dots-fade" \/>/g) ?? []).length).toBe(1);
  });

  it("preserves per-instance title on a deduped occurrence", () => {
    expect(spriteHtml).toMatch(
      /<title id="astro-icon-title-[^"]+">Third<\/title><use href="#ai:icons:3-dots-fade" \/>/,
    );
  });

  it("leaves the icon rendered outside the Sprite boundary as a plain, non-deduped svg", () => {
    // Six total occurrences of the icon marker: 5 inside the Sprite
    // (now <use>s) + 1 outside (still fully inline).
    expect((spriteHtml.match(/data-icon="3-dots-fade"/g) ?? []).length).toBe(6);
    expect((spriteHtml.match(/<use href="#ai:icons:3-dots-fade" \/>/g) ?? []).length).toBe(5);
    expect(spriteHtml.match(/<circle/g)?.length).toBeGreaterThanOrEqual(1);
  });

  it("passes a <LiveIcon> inside the Sprite boundary through untouched, never deduped", () => {
    expect(spriteHtml).toContain('data-icon="liveSpinners:3-dots-fade" data-icon-live');
    expect(spriteHtml).not.toContain('<use href="#ai:liveSpinners:3-dots-fade" />');
    expect(spriteHtml).not.toContain('<symbol id="ai:liveSpinners:3-dots-fade"');
  });
});
