import { defineConfig } from "astro/config";

// The consumer's config. Nothing here is aware that `acme-ui`'s icons
// (src/lib/icons.ts) even exist as a separate "package" - that's the point:
// a library's icons work under whatever rendering mode the consumer picks.
export default defineConfig({});
