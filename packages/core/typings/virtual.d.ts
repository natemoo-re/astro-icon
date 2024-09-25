/// <reference types="astro/jsx-runtime" />

declare module "astro:icons/*" {
    type Props = {
		/**
		 * Accesible, short-text description
		 * 
		 *  {@link https://developer.mozilla.org/en-US/docs/Web/SVG/Element/title|MDN Reference}
		 */
		title?: string;
		/**
		 * Shorthand for setting the `height` and `width` properties
		 * @default 24
		 */
		size?: number | string;
		/**
		 * Bypasses automatic sprite optimization by directly inlinining the SVG
		 */
		inline?: boolean
	} & astroHTML.JSX.SVGAttributes
	
	const Component: (_props: Props) => any;
	export default Component;
}