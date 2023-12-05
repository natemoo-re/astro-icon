import * as fs from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import resolvePackage from "resolve-pkg";

export interface CreateIconPackOptions {
  package?: string;
  dir?: string;
  url?: string;
}

export function createIconPack({
  package: pkg,
  dir,
  url,
}: CreateIconPackOptions) {
  if (pkg) {
    return async (name: string) => {
      const pkgPath = resolvePackage(pkg);
      if (!pkgPath) {
        throw new Error(
          `[astro-icon] Unable to resolve "${pkgPath}"! Is the package installed?"`
        );
      }

      const baseUrl = new URL(pathToFileURL(pkgPath) + "/");
      const path = fileURLToPath(
        new URL(dir ? `${dir}/${name}.svg` : `${name}.svg`, baseUrl)
      );
      try {
        const svg = await fs.readFile(path, "utf8");
        return svg;
      } catch {
        throw new Error(
          `[astro-icon] Unable to load "${path}"! Does the file exist?"`
        );
      }
    };
  }

  if (url) {
    const baseUrl = new URL(url);
    const fetchCache = new Map();
    return async (name: string) => {
      const url = new URL(name + ".svg", baseUrl).toString();
      if (fetchCache.has(url)) {
        return fetchCache.get(url);
      }
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Failed to fetch "${url}"!\n${body}`);
      }
      const svg = await res.text();
      fetchCache.set(url, svg);
      return svg;
    };
  }
}
