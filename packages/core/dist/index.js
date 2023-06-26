import { createPlugin } from "./vite-plugin-astro-icon.js";
export default function createIntegration(opts = {}) {
    return {
        name: "astro-icon",
        hooks: {
            async "astro:config:setup"({ updateConfig, command, config }) {
                updateConfig({
                    vite: {
                        plugins: [await createPlugin(opts, { root: config.root })],
                    },
                });
            },
        },
    };
}
