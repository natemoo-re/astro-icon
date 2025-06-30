import type {
  AstroIconCollectionMap,
  IconCollection,
  IntegrationOptions,
} from "../../typings/integration";
import type { AutoInstall } from "../../typings/iconify";

import { readFile } from "node:fs/promises";
import { getIcons } from "@iconify/utils";
import { loadCollectionFromFS } from "@iconify/utils/lib/loader/fs";
import { promisify } from "node:util";
import { exec } from "node:child_process";
import { dirname } from "node:path";

const execa = promisify(exec);

interface LoadOptions {
  root: URL;
  include?: IntegrationOptions["include"];
}

export default async function loadIconifyCollections({
  root,
  include = {},
}: LoadOptions): Promise<AstroIconCollectionMap> {
  const installedCollections = await detectInstalledCollections(root);
  // If icons are installed locally but not explicitly included, include the whole pack
  for (let name of installedCollections) {
    if (include[name] !== undefined) continue;
    include[name] = ["*"];
  }
  const possibleCollections = await Promise.all(
    installedCollections.map((collectionName) =>
      loadCollection(collectionName).then(
        (possibleCollection) => [collectionName, possibleCollection] as const,
      ),
    ),
  );

  const collections = possibleCollections.reduce<AstroIconCollectionMap>(
    (acc, [name, collection]) => {
      if (!collection) {
        console.error(
          `[astro-icon] "${name}" does not appear to be a valid iconify collection! Did you install the "@iconify-json/${name}" dependency?`,
        );
        return acc;
      }

      const requestedIcons = Array.from(new Set(include[name]));

      // Requested entire icon collection
      if (requestedIcons.length === 1 && requestedIcons[0] === "*") {
        acc[name] = collection;
        return acc;
      }

      const reducedCollection = getIcons(collection, requestedIcons);
      if (!reducedCollection) {
        console.error(
          `[astro-icon] "${name}" failed to load the specified icons!`,
        );
        return acc;
      } else if (
        Object.keys(reducedCollection.icons).length !== requestedIcons.length
      ) {
        console.error(
          `[astro-icon] "${name}" failed to load at least one of the specified icons! Verify the icon names are included in the icon collection.`,
        );
      }

      acc[name] = reducedCollection;
      return acc;
    },
    {},
  );

  return collections;
}

export async function loadCollection(
  name: string,
  autoInstall?: AutoInstall,
): Promise<IconCollection | void> {
  if (!name) return;

  return loadCollectionFromFS(name, autoInstall);
}

export async function findNearestPackageJson(
  startUrl: URL,
): Promise<URL | null> {
  let currentPath = startUrl.pathname;

  // Convert to file:// URL if it's not already
  if (!startUrl.protocol.startsWith("file:")) {
    throw new Error("Expected file:// URL");
  }

  while (currentPath !== "/" && currentPath !== "") {
    try {
      const packageJsonUrl = new URL("package.json", `file://${currentPath}/`);
      const text = await readFile(packageJsonUrl, { encoding: "utf8" });
      const { dependencies = {}, devDependencies = {} } = JSON.parse(text);

      // Check if this package.json has any @iconify-json dependencies
      const allDeps = [
        ...Object.keys(dependencies),
        ...Object.keys(devDependencies),
      ];
      const hasIconifyDeps = allDeps.some((dep) =>
        dep.startsWith("@iconify-json/"),
      );

      if (hasIconifyDeps) {
        return packageJsonUrl;
      }

      // If no iconify deps, continue searching up the tree
      currentPath = dirname(currentPath);
    } catch {
      // package.json not found at this level, go up one directory
      currentPath = dirname(currentPath);
    }
  }

  return null;
}

async function detectInstalledCollections(root: URL) {
  try {
    let packages: string[] = [];

    // Find the nearest package.json by traversing up the directory tree
    const packageJsonUrl = await findNearestPackageJson(root);
    if (!packageJsonUrl) {
      return [];
    }

    const text = await readFile(packageJsonUrl, {
      encoding: "utf8",
    });
    const { dependencies = {}, devDependencies = {} } = JSON.parse(text);
    packages.push(...Object.keys(dependencies));
    packages.push(...Object.keys(devDependencies));
    const collections = packages
      .filter((name) => name.startsWith("@iconify-json/"))
      .map((name) => name.replace("@iconify-json/", ""));
    return collections;
  } catch {}
  return [];
}
