import node from "@astrojs/node";
import { defineConfig } from "astro/config";
import { icon } from "astro-icon/integration";

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [icon()],
});
