import { parseIconSVG } from "astro-icon/loaders";
import type { IconSource } from "astro-icon/loaders";

export interface ServiceSourceOptions {
  /** Base URL of a running `packages/service` instance. Defaults to `ASTRO_ICON_SERVICE_URL`, or `http://localhost:3001`. */
  url?: string;
  /**
   * Identifies the returned {@link IconSource}. For a live collection this
   * must match the collection key it's registered under in `live.config.ts`
   * (a `LiveLoader` is never told its own name), so it defaults to `pack`
   * only as a convenience for build-time use.
   */
  name?: string;
}

/**
 * An {@link IconSource} backed by this package's icon-serving API
 * (`GET /api/v1/icon`, see `api/v1/icon.ts`). Point it at a deployment with
 * `options.url`, or run `pnpm --filter service dev` for the `localhost:3001`
 * default.
 */
export function serviceSource(
  pack: string,
  options: ServiceSourceOptions = {},
): IconSource {
  const url =
    options.url ??
    process.env.ASTRO_ICON_SERVICE_URL ??
    "http://localhost:3001";
  const name = options.name ?? pack;

  async function request(query: string): Promise<Response> {
    const res = await fetch(`${url}/api/v1/icon?${query}`);
    if (!res.ok) {
      throw new Error(
        `[service] API returned ${res.status} for "${query}": is \`pnpm --filter service dev\` running?`,
      );
    }
    return res;
  }

  return {
    name,
    async getIcon(iconName) {
      const res = await request(
        `pack=${pack}&name=${encodeURIComponent(iconName)}`,
      );
      const svg = await res.text();
      return parseIconSVG(svg, {
        collection: pack,
        name: iconName,
        logger: { warn: (msg) => console.warn(msg) },
      });
    },
    async listIcons() {
      const res = await request(`pack=${pack}`);
      return res.json();
    },
  };
}
