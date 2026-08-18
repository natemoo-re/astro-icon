import { defineConfig } from "astro/config";
import { icon } from "astro-icon/integration";

// Fully static: every page here is prerendered, which is what makes sprite
// optimization free for this persona - no server, no config, no opt-in.
export default defineConfig({
  integrations: [icon()],
});
