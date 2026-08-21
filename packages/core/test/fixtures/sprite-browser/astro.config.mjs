import preact from "@astrojs/preact";
import { defineConfig } from "astro/config";
import { icon } from "astro-icon/integration";

export default defineConfig({
  output: "static",
  integrations: [icon(), preact()],
});
