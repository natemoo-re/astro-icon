import { readdirSync } from "node:fs";
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { createIconLoader, localSource } from "astro-icon/loaders";

// The same names `localSource()` resolves for `icons` below, read directly so
// the `work` schema can check each project's `icon:` frontmatter field
// against them - a typo becomes a build error where the frontmatter is
// written, not a blank icon discovered at runtime. See UC3 in PERSONA.md.
const iconNames = readdirSync(new URL("./icons/", import.meta.url))
  .filter((file) => file.endsWith(".svg"))
  .map((file) => file.replace(/\.svg$/, "")) as [string, ...string[]];

export const collections = {
  // Load every `.svg` file in the default `src/icons/` directory. No options
  // to tune - `<Icon name="..." />` resolves bare names against this collection.
  icons: defineCollection({ loader: createIconLoader(localSource()) }),
  work: defineCollection({
    // Load Markdown files in the src/content/work directory.
    loader: glob({ base: "./src/content/work", pattern: "**/*.md" }),
    schema: z.object({
      title: z.string(),
      description: z.string(),
      publishDate: z.coerce.date(),
      tags: z.array(z.string()),
      img: z.string(),
      img_alt: z.string().optional(),
      icon: z.enum(iconNames),
    }),
  }),
};
