import node from "@astrojs/node";
import { defineConfig } from "astro/config";
import { icon } from "astro-icon/integration";

// Server output: /dashboard is SSR by default (fresh data per request), while
// /login opts into prerender - a real hybrid app, not an all-static site.
export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [icon()],
});
