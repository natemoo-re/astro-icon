import node from "@astrojs/node";
import { defineConfig } from "astro/config";
import { icon } from "astro-icon/integration";

// Server output throughout: this persona's pages depend on data (and on what a
// user just typed), so there's nothing meaningful to prerender.
export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [icon()],
});
