import node from "@astrojs/node";
import { defineConfig } from "astro/config";

// Server output: `/` (dashboard) and `/users` are SSR by default - fresh data
// per request - while the sign-in page opts into prerendering. A real hybrid
// app, not an all-static site.
export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
});
