import { defineConfig, devices } from "@playwright/test";

const PORT = 4322;

/**
 * Browser verification for the sprite build rewrite - step 5 of
 * SPRITESHEET-DESIGN.md's sequencing. Separate from the vitest suite
 * (`pnpm test`) deliberately: everything else in this package is testable
 * without a real browser, and this is the one place that genuinely needs
 * one (hydration and client-side navigation aren't things jsdom/happy-dom
 * can stand in for here - both claims being checked are specifically about
 * real browser behavior).
 */
export default defineConfig({
  testDir: "./test/browser",
  fullyParallel: true,
  webServer: {
    command: `node_modules/.bin/astro build --root test/fixtures/sprite-browser && node test/browser/serve.mjs ${PORT}`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 60_000,
  },
  use: {
    baseURL: `http://localhost:${PORT}`,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
