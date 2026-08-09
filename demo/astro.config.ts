import node from "@astrojs/node";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  // Server output so `src/pages/live.astro` can render <LiveIcon> per
  // request. Everything else opts back into prerendering below.
  output: "server",
  adapter: node({ mode: "standalone" }),
});
