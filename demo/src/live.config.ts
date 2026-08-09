import { defineLiveCollection } from "astro:content";
import { parseIconSVG } from "astro-icon/loaders";
import { createLiveIconLoader, iconifyLive } from "astro-icon/loaders/live";
import type { IconSource } from "astro-icon/loaders/live";

// astro-icon's own "resolve straight from Iconify" live source.
const mdiLive = iconifyLive("mdi");

// A from-scratch `IconSource`, wired to this repo's `packages/service` -
// the old astro-icon v0 remote icon API - showing that <LiveIcon> isn't
// tied to Iconify's resolution path at all. Run `pnpm --filter service dev`
// (or `pnpm dev` at the repo root) before loading /live/ to see this work.
const SERVICE_URL = process.env.ASTRO_ICON_SERVICE_URL ?? "http://localhost:3001";
const SERVICE_PACK = "tabler";

const serviceSource: IconSource = {
  // Matches the "service" key below - LiveLoaders aren't told their own
  // collection name by Astro, so typegen keys off of `source.name` instead.
  name: "service",
  async getIcon(name) {
    const res = await fetch(
      `${SERVICE_URL}/api/v1/icon?pack=${SERVICE_PACK}&name=${encodeURIComponent(name)}`,
    );
    if (!res.ok) {
      throw new Error(
        `[demo] service API returned ${res.status} for "${SERVICE_PACK}:${name}" - is \`pnpm --filter service dev\` running?`,
      );
    }
    const svg = await res.text();
    return parseIconSVG(svg, {
      collection: SERVICE_PACK,
      name,
      logger: { warn: (msg) => console.warn(msg) },
    });
  },
  async listIcons() {
    const res = await fetch(`${SERVICE_URL}/api/v1/icon?pack=${SERVICE_PACK}`);
    if (!res.ok) {
      throw new Error(`[demo] service API returned ${res.status} listing "${SERVICE_PACK}"`);
    }
    return res.json();
  },
};

export const collections = {
  mdi: defineLiveCollection({ loader: mdiLive }),
  service: defineLiveCollection({ loader: createLiveIconLoader(serviceSource) }),
};
