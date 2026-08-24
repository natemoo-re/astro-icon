/* The upstream template used the @astrojs/tailwind integration (Tailwind v3).
   That integration is gone in current Astro, but Tailwind v3 works fine as a
   plain PostCSS plugin, which keeps the template's v3 utility classes as-is. */
module.exports = {
	plugins: {
		tailwindcss: {},
		autoprefixer: {},
	},
};
