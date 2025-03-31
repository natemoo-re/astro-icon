/// <reference types="astro/client" />

// IMPORTANT: This MUST come before the other module to ensure the typing applies correctly
declare module "virtual:icons/*?raw" {
  const rawSvg: string;
  export default rawSvg;
}

declare module "virtual:icons/*" {
  type Props = {
    /**
     * Accessible, short-text description
     *
     *  {@link https://developer.mozilla.org/en-US/docs/Web/SVG/Element/title|MDN Reference}
     */
    title?: string;
    /**
     * Shorthand for setting the `height` and `width` properties
     * @default 24
     */
    size?: number | string;
  } & astroHTML.JSX.SVGAttributes;

  const Component: (_props: Props) => any;
  export default Component;
}
