import { z } from "astro/zod";

/** Default schema for an `IconEntry`, overridable via `defineCollection({ loader, schema })`. */
export const iconEntrySchema = z
  .object({
    body: z.string(),
    viewBox: z.string(),
    width: z.number(),
    height: z.number(),
  })
  .catchall(z.union([z.string(), z.number()]));
