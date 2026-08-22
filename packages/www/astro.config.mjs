import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

// https://astro.build/config
export default defineConfig({
  site: "https://www.astroicon.dev",
  integrations: [
    starlight({
      title: "Astro Icon",
      description:
        "Render SVG icons in Astro as inline <svg> elements, with full TypeScript autocomplete for every icon name.",
      // Starlight renders the logo as an <img>, where `currentColor` has no
      // inherited color to resolve against — hence baked-in colors per theme,
      // rather than reusing src/icons/logo.svg (which astro-icon inlines).
      logo: {
        light: "./src/assets/logo-light.svg",
        dark: "./src/assets/logo-dark.svg",
        alt: "",
      },
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/natemoo-re/astro-icon",
        },
        {
          icon: "npm",
          label: "npm",
          href: "https://www.npmjs.com/package/astro-icon",
        },
      ],
      components: {
        Hero: "./src/components/Hero.astro",
      },
      customCss: ["./src/styles/custom.css"],
      sidebar: [
        {
          label: "Start Here",
          items: [
            { label: "Getting Started", link: "/getting-started/" },
            { label: "Upgrading to v2", link: "/guides/upgrade/v2/" },
            { label: "Acknowledgements", link: "/acknowledgements/" },
          ],
        },
        {
          label: "Icon Sources",
          items: [
            { label: "Local Icons", link: "/guides/local-icons/" },
            { label: "Iconify Icons", link: "/guides/iconify-icons/" },
            {
              label: "Bringing Your Own Source",
              link: "/guides/bring-your-own-source/",
              badge: { text: "New", variant: "success" },
            },
            {
              label: "Shipping Icons from a Library",
              link: "/guides/shipping-icons-from-a-library/",
              badge: { text: "New", variant: "success" },
            },
          ],
        },
        {
          label: "Components",
          items: [
            { label: "The <Icon> Component", link: "/guides/components/" },
            { label: "Styling Icons", link: "/guides/styling/" },
            {
              label: "Live Icons with <LiveIcon>",
              link: "/guides/live-icon/",
              badge: { text: "New", variant: "success" },
            },
            {
              label: "Framework Components",
              link: "/guides/framework-components/",
            },
          ],
        },
        {
          label: "Optimizing",
          items: [{ label: "SVGO & optimize()", link: "/guides/optimize/" }],
        },
        {
          label: "Guides",
          items: [
            { label: "Deployment", link: "/guides/deployment/" },
            { label: "Troubleshooting", link: "/guides/troubleshooting/" },
          ],
        },
        {
          label: "Reference",
          items: [{ autogenerate: { directory: "reference" } }],
        },
      ],
    }),
  ],
});
