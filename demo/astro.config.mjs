import { defineConfig } from 'astro/config';
import icon from 'astro-icon';

// https://astro.build/config
export default defineConfig({
    integrations: [
        icon({
            include: {
                ic: ['*'],
                fe: ['*'],
                ri: ['*'],
                bi: ['*'],
            },
            allowStandalone: true,
        })
    ]
});
