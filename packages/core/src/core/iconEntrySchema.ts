import { z } from "astro/zod";

/**
 * The default schema for an `IconEntry` - lets a collection's data be
 * validated (and its type inferred) the same way any other content
 * collection's is, unless a user overrides it via `defineCollection({
 * loader, schema })`.
 */
export const iconEntrySchema = z
  .object({
    body: z.string(),
    viewBox: z.string(),
    width: z.number(),
    height: z.number(),
  })
  .catchall(z.union([z.string(), z.number()]));
