import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { createIconLoader, localSource } from 'astro-icon/loaders';
import { acmeUiIcons } from './lib/icons';

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			// Transform string to Date object
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: z.optional(image()),
		}),
});

export const collections = {
	blog,

	// This site's own social icons - a plain `localSource()` collection, no
	// different from site-builder's. [UC1]
	icons: defineCollection({ loader: createIconLoader(localSource()) }),

	// This is the only line that "installs" the library: a spread, the same
	// way any other astro-icon consumer would add `acme-ui/icons` from
	// node_modules. `src/lib/` just happens to live in this repo instead of
	// a separate one. [UC6]
	...acmeUiIcons,
};
