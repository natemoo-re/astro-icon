import { statSync, promises as fs } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

export interface CreateIconPackOptions {
  package?: string;
  dir?: string;
  url?: string;
}

export default function createIconPack({
  package: pkg,
  dir,
  url,
}: CreateIconPackOptions) {
  if (pkg) {
    const baseUrl = pathToFileURL(require.resolve(`${pkg}/package.json`));
    return async (name: string) => {
      const path = fileURLToPath(
        new URL(dir ? `${dir}/${name}.svg` : `${name}.svg`, baseUrl)
      );
      if (!exists(path)) {
        throw new Error(`[astro-icon] Unable to load "${path}"! Does the file exist?"`)
      }
      const svg = await fs
        .readFile(path)
        .then((res) => res.toString());
      return svg;
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

const exists = (path: string): boolean => {
  try {
    return statSync(path).isFile()
  } catch (e) {}
  return false;
}
