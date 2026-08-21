import node from "@astrojs/node";
import { defineConfig } from "astro/config";
import { icon } from "astro-icon/integration";

// Deliberately has no prerendered route anywhere. Astro's `generatePages()` returns
// early when nothing is prerendered, so `astro:build:generated` never fires for this
// shape of app - which is what makes it worth its own fixture.
export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [icon()],
});
