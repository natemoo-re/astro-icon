import node from "@astrojs/node";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  // Server output so live.astro can render <LiveIcon> per request.
  output: "server",
  adapter: node({ mode: "standalone" }),
});
