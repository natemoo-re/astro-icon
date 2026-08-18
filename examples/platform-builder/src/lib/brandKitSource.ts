import { parseIconSVG, type IconSource } from "astro-icon/loaders";

// Stands in for the internal API a platform would really call here - a design-tool
// export, a tenant's uploaded brand kit, a database table. Inlined so this example
// runs with `pnpm dev` and nothing else; swap the lookup in `getIcon` for a `fetch`
// and the rest of the source is unchanged.
const BRAND_KIT: Record<string, string> = {
  "acme/logo": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 2l9 5v10l-9 5-9-5V7z" /><path d="M12 12l9-5M12 12v10M12 12L3 7" /></svg>`,
  "acme/spark": `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" /></svg>`,
  "globex/wave": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 12c3 0 3-5 6-5s3 10 6 10 3-5 6-5" /></svg>`,
  "globex/orbit": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4" /><ellipse cx="12" cy="12" rx="10" ry="4.5" /></svg>`,
};

export interface BrandKitSourceOptions {
  /**
   * Must match the key this source's collection is registered under in
   * `live.config.ts`. A `LiveLoader` is never told its own collection name, so
   * typegen records the live collection under the *source's* name - if the two
   * disagree, `<LiveIcon collection="...">` autocompletes to a name that
   * doesn't exist. Taken as an option rather than hardcoded so the caller can
   * keep them in sync at the one place both are visible.
   */
  name: string;
}

/**
 * A custom `IconSource` - the plug point for any backend astro-icon doesn't
 * ship. The contract is small on purpose: a `name`, `getIcon(name)`, and an
 * optional `listIcons()`.
 */
export function brandKitSource({ name: sourceName }: BrandKitSourceOptions): IconSource {
  return {
    name: sourceName,

    async getIcon(name) {
      const svg = BRAND_KIT[name];
      // Throwing (rather than returning undefined) is the contract: it's what lets
      // <LiveIcon> report *which* icon failed instead of rendering a silent blank.
      if (!svg) throw new Error(`No brand-kit icon named "${name}".`);

      // Turns a raw `<svg>...</svg>` string into the shape astro-icon stores,
      // deriving a viewBox if the source didn't provide one.
      return parseIconSVG(svg, {
        collection: sourceName,
        name,
        logger: { warn: console.warn },
      });
    },

    // Optional for a live collection, but implementing it is what makes
    // getLiveCollection() able to enumerate the kit - which is how the picker
    // on /brand lists icons without hardcoding their names.
    async listIcons() {
      return Object.keys(BRAND_KIT);
    },
  };
}
