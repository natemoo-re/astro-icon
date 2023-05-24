// @ts-check
import { defineConfig } from 'astro/config';
import icon from 'astro-icon';

// https://astro.build/config
export default defineConfig({
    site: 'https://github.com',
    base: '/natemoo-re/astro-icon',
    integrations: [
        icon({
            include: {
              pixelarticons: ['external-link'],
            }
        })
    ]
});
