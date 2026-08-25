import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadLocalPack } from "../src/content/iconify/pack.js";

// Regression test for https://github.com/natemoo-re/astro-icon/issues/187:
// "Installed icon packs are not detected in a monorepo setup, particularly
// when there's only a single package.json in the root directory."
//
// `loadLocalPack` resolves `pack` relative to the `cwd` it's given (the
// content-layer loader passes the consuming project's root, not
// astro-icon's own install location). `@iconify/utils`'s `loadCollectionFromFS`
// resolves the pack via `mlly`'s `resolvePath`, which follows Node's
// directory-walking `node_modules` resolution algorithm - so a pack hoisted
// to a workspace root is found as long as the given `cwd` is anywhere under
// that root, even when the consuming package has no local `node_modules`
// of its own.
const fixtureRoot = path.resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "fixtures/monorepo-hoisting",
);
const consumerDir = path.join(fixtureRoot, "apps/consumer");

describe("loadLocalPack in a monorepo with hoisted deps", () => {
  it("finds a pack hoisted to the workspace root when run from a nested package with no local node_modules", async () => {
    // `apps/consumer` has its own package.json but deliberately no
    // node_modules of its own; the pack only exists under the fixture
    // root's node_modules (simulating pnpm/npm/yarn hoisting).
    const result = await loadLocalPack("test-pack", consumerDir);

    expect(result).toBeDefined();
    expect(result?.prefix).toBe("test-pack");
    expect(result?.icons.foo).toBeDefined();
  });
});
