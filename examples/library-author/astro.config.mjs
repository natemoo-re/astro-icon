import { defineConfig } from "astro/config";
import { icon } from "astro-icon/integration";

// The consumer's config. Nothing here is aware that `acme-ui`'s icons
// (src/lib/icons.ts) even exist as a separate "package" - that's the point:
// a library's icons work under whatever rendering mode the consumer picks,
// with or without this integration installed.
export default defineConfig({
  integrations: [icon()],
});
