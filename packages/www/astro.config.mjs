import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'Astro Icon',
			social: {
				github: 'https://github.com/natemoo-re/astro-icon',
			},
			sidebar: [
				{
					label: 'Start Here',
					items: [
						{ label: 'Getting Started', link: '/getting-started/' },
						{ label: 'Upgrade to v1', link: '/guides/upgrade/v1/' },
						{ label: 'Acknowledgements', link: '/acknowledgements/' },
					],
				},
				{
					label: 'Guides',
					items: [
						{ label: 'Customizing Icons', link: '/guides/customization/' },
						{ label: 'Components', link: '/guides/components/' },
						{ label: 'CSS & Styling', link: '/guides/styling/' },
						{ label: 'Deployment', link: '/guides/deployment/' },
					],
				},
				{
					label: 'Reference',
					autogenerate: { directory: 'reference' },
				},
			],
		}),
	],
});
