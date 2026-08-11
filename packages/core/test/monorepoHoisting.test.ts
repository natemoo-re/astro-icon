import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  __clearPackCache,
  resolveLocalPack,
} from "../src/iconify/resolvePack.js";

// Regression test for https://github.com/natemoo-re/astro-icon/issues/187:
// "Installed icon packs are not detected in a monorepo setup, particularly
// when there's only a single package.json in the root directory."
//
// `resolveLocalPack` calls `loadCollectionFromFS(pack)` with no explicit
// `cwd`, so it resolves relative to `process.cwd()` at call time (the
// content-layer loader runs from the consuming project, not from
// astro-icon's own install location). `@iconify/utils`'s `loadCollectionFromFS`
// resolves the pack via `mlly`'s `resolvePath`, which follows Node's
// directory-walking `node_modules` resolution algorithm - so a pack hoisted
// to a workspace root is found as long as `process.cwd()` is anywhere under
// that root, even when the consuming package has no local `node_modules`
// of its own.
const fixtureRoot = path.resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "fixtures/monorepo-hoisting",
);
const consumerDir = path.join(fixtureRoot, "apps/consumer");

describe("resolveLocalPack in a monorepo with hoisted deps", () => {
  const originalCwd = process.cwd();

  afterEach(() => {
    process.chdir(originalCwd);
    __clearPackCache();
  });

  it("finds a pack hoisted to the workspace root when run from a nested package with no local node_modules", async () => {
    // `apps/consumer` has its own package.json but deliberately no
    // node_modules of its own; the pack only exists under the fixture
    // root's node_modules (simulating pnpm/npm/yarn hoisting).
    process.chdir(consumerDir);

    const result = await resolveLocalPack("test-pack");

    expect(result).toBeDefined();
    expect(result?.prefix).toBe("test-pack");
    expect(result?.icons.foo).toBeDefined();
  });
});
