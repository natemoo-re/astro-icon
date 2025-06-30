import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import loadIconifyCollections, {
  findNearestPackageJson,
} from "../loadIconifyCollections.js";

// Mock the @iconify/utils module
vi.mock("@iconify/utils/lib/loader/fs", () => ({
  loadCollectionFromFS: vi.fn(() => ({
    prefix: "test",
    icons: {
      "test-icon": {
        body: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
      },
    },
  })),
}));

describe("loadIconifyCollections", () => {
  let tempDir: string;
  let rootUrl: URL;

  beforeEach(async () => {
    // Create a temporary directory for each test
    tempDir = await fs.mkdtemp(join(tmpdir(), "astro-icon-test-"));
    rootUrl = new URL(`file://${tempDir}/`);
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("package.json detection in regular project", () => {
    it("should find package.json in the same directory", async () => {
      // Create package.json in root
      const packageJson = {
        dependencies: {
          "@iconify-json/heroicons": "^1.0.0",
        },
      };
      await fs.writeFile(
        join(tempDir, "package.json"),
        JSON.stringify(packageJson),
      );

      const collections = await loadIconifyCollections({ root: rootUrl });

      expect(collections).toBeDefined();
      expect(Object.keys(collections)).toContain("heroicons");
    });

    it("should return empty collections when no package.json exists", async () => {
      const collections = await loadIconifyCollections({ root: rootUrl });

      expect(collections).toEqual({});
    });
  });

  describe("package.json detection in monorepo setup", () => {
    it("should find package.json in parent directory", async () => {
      // Create nested directory structure: tempDir/packages/app/
      const appDir = join(tempDir, "packages", "app");
      await fs.mkdir(appDir, { recursive: true });

      // Create package.json in root (parent of packages)
      const rootPackageJson = {
        dependencies: {
          "@iconify-json/tabler": "^1.0.0",
          "@iconify-json/lucide": "^1.0.0",
        },
      };
      await fs.writeFile(
        join(tempDir, "package.json"),
        JSON.stringify(rootPackageJson),
      );

      // Create app-specific package.json without icon dependencies
      const appPackageJson = {
        name: "app",
        dependencies: {
          astro: "^4.0.0",
        },
      };
      await fs.writeFile(
        join(appDir, "package.json"),
        JSON.stringify(appPackageJson),
      );

      // Run from app directory
      const appUrl = new URL(`file://${appDir}/`);
      const collections = await loadIconifyCollections({ root: appUrl });

      expect(collections).toBeDefined();
      expect(Object.keys(collections)).toContain("tabler");
      expect(Object.keys(collections)).toContain("lucide");
    });

    it("should traverse multiple levels up to find package.json", async () => {
      // Create deeply nested structure: tempDir/packages/frontend/apps/web/
      const webDir = join(tempDir, "packages", "frontend", "apps", "web");
      await fs.mkdir(webDir, { recursive: true });

      // Create package.json only at root level
      const rootPackageJson = {
        dependencies: {
          "@iconify-json/mdi": "^1.0.0",
        },
      };
      await fs.writeFile(
        join(tempDir, "package.json"),
        JSON.stringify(rootPackageJson),
      );

      // Run from deeply nested directory
      const webUrl = new URL(`file://${webDir}/`);
      const collections = await loadIconifyCollections({ root: webUrl });

      expect(collections).toBeDefined();
      expect(Object.keys(collections)).toContain("mdi");
    });

    it("should prefer closest package.json with iconify dependencies", async () => {
      // Create nested structure: tempDir/packages/app/
      const appDir = join(tempDir, "packages", "app");
      await fs.mkdir(appDir, { recursive: true });

      // Create package.json in root
      const rootPackageJson = {
        dependencies: {
          "@iconify-json/heroicons": "^1.0.0",
        },
      };
      await fs.writeFile(
        join(tempDir, "package.json"),
        JSON.stringify(rootPackageJson),
      );

      // Create closer package.json in packages dir with iconify deps
      const packagesPackageJson = {
        dependencies: {
          "@iconify-json/feather": "^1.0.0",
        },
      };
      await fs.writeFile(
        join(tempDir, "packages", "package.json"),
        JSON.stringify(packagesPackageJson),
      );

      // Run from app directory - should find the closest one with iconify deps
      const appUrl = new URL(`file://${appDir}/`);
      const collections = await loadIconifyCollections({ root: appUrl });

      expect(collections).toBeDefined();
      expect(Object.keys(collections)).toContain("feather");
      expect(Object.keys(collections)).not.toContain("heroicons");
    });

    it("should skip package.json without iconify dependencies", async () => {
      // Create nested structure: tempDir/packages/app/
      const appDir = join(tempDir, "packages", "app");
      await fs.mkdir(appDir, { recursive: true });

      // Create package.json in root with iconify deps
      const rootPackageJson = {
        dependencies: {
          "@iconify-json/heroicons": "^1.0.0",
        },
      };
      await fs.writeFile(
        join(tempDir, "package.json"),
        JSON.stringify(rootPackageJson),
      );

      // Create closer package.json in packages dir WITHOUT iconify deps
      const packagesPackageJson = {
        dependencies: {
          react: "^18.0.0",
        },
      };
      await fs.writeFile(
        join(tempDir, "packages", "package.json"),
        JSON.stringify(packagesPackageJson),
      );

      // Run from app directory - should skip packages/package.json and find root
      const appUrl = new URL(`file://${appDir}/`);
      const collections = await loadIconifyCollections({ root: appUrl });

      expect(collections).toBeDefined();
      expect(Object.keys(collections)).toContain("heroicons");
    });
  });

  describe("dependency parsing", () => {
    it("should parse both dependencies and devDependencies", async () => {
      const packageJson = {
        dependencies: {
          "@iconify-json/carbon": "^1.0.0",
          react: "^18.0.0",
        },
        devDependencies: {
          "@iconify-json/phosphor": "^1.0.0",
          vitest: "^1.0.0",
        },
      };
      await fs.writeFile(
        join(tempDir, "package.json"),
        JSON.stringify(packageJson),
      );

      const collections = await loadIconifyCollections({ root: rootUrl });

      expect(Object.keys(collections)).toContain("carbon");
      expect(Object.keys(collections)).toContain("phosphor");
      expect(Object.keys(collections)).not.toContain("react");
      expect(Object.keys(collections)).not.toContain("vitest");
    });

    it("should ignore non-iconify packages", async () => {
      const packageJson = {
        dependencies: {
          "@iconify-json/heroicons": "^1.0.0",
          "@types/node": "^18.0.0",
          astro: "^4.0.0",
        },
      };
      await fs.writeFile(
        join(tempDir, "package.json"),
        JSON.stringify(packageJson),
      );

      const collections = await loadIconifyCollections({ root: rootUrl });

      expect(Object.keys(collections)).toContain("heroicons");
      expect(Object.keys(collections)).not.toContain("types");
      expect(Object.keys(collections)).not.toContain("astro");
    });
  });
});
