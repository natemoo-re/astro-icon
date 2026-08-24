import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";
import { createIconLoader, iconifyLocalSource } from "astro-icon/loaders";

const metadataDefinition = () =>
  z
    .object({
      title: z.string().optional(),
      ignoreTitleTemplate: z.boolean().optional(),

      canonical: z.url().optional(),

      robots: z
        .object({
          index: z.boolean().optional(),
          follow: z.boolean().optional(),
        })
        .optional(),

      description: z.string().optional(),

      openGraph: z
        .object({
          url: z.string().optional(),
          siteName: z.string().optional(),
          images: z
            .array(
              z.object({
                url: z.string(),
                width: z.number().optional(),
                height: z.number().optional(),
              }),
            )
            .optional(),
          locale: z.string().optional(),
          type: z.string().optional(),
        })
        .optional(),

      twitter: z
        .object({
          handle: z.string().optional(),
          site: z.string().optional(),
          cardType: z.string().optional(),
        })
        .optional(),
    })
    .optional();

const postCollection = defineCollection({
  loader: glob({ pattern: ["*.md", "*.mdx"], base: "src/data/post" }),
  schema: z.object({
    publishDate: z.date().optional(),
    updateDate: z.date().optional(),
    draft: z.boolean().optional(),

    title: z.string(),
    excerpt: z.string().optional(),
    image: z.string().optional(),

    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    author: z.string().optional(),

    metadata: metadataDefinition(),
  }),
});

export const collections = {
  post: postCollection,

  // The 1:1 port of upstream AstroWind's astro-icon v1 config:
  //
  //   icon({ include: { tabler: ['*'], 'flat-color-icons': [...] } })
  //
  // AstroWind's whole design is icon names as plain strings in page data and
  // config (`icon: 'tabler:download'`) - which is exactly this persona's
  // problem. The two packs land on opposite sides of the bounded/unbounded
  // split:
  //
  // `tabler: ['*']` becomes an *unbounded* collection ([UC4]): the template
  // treats the full pack as an open catalog for whatever its data names, so
  // every sync loads and types all 5,000+ icons, and a name assembled at
  // runtime needs an `as IconName` cast.
  tabler: defineCollection({
    loader: createIconLoader(iconifyLocalSource("tabler")),
  }),

  // The nine flat-color-icons stay a curated `allowed` list ([UC3]): the set
  // is small enough to write down, so the collection (and its types) are
  // exactly these names, and a typo in page data is a build error.
  "flat-color-icons": defineCollection({
    loader: createIconLoader(
      iconifyLocalSource("flat-color-icons", {
        allowed: [
          "template",
          "gallery",
          "approval",
          "document",
          "advertising",
          "currency-exchange",
          "voice-presentation",
          "business-contact",
          "database",
        ],
      }),
    ),
  }),
};
