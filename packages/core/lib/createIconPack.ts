import { promises as fs } from "fs";
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
      const svg = await fs
        .readFile(
          fileURLToPath(
            new URL(dir ? `${dir}/${name}.svg` : `${name}.svg`, baseUrl)
          )
        )
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
      const svg = await fetch(url).then((res) => res.text());
      fetchCache.set(url, svg);
      return svg;
    };
  }
}
