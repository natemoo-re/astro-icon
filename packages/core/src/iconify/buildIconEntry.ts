import type { IconifyJSON } from "@iconify/types";
import { getIconData, iconToHTML, iconToSVG } from "@iconify/utils";
import type { AstroIntegrationLogger } from "astro";
import { parseIconSVG } from "../core/parseIconSVG.js";
import type { IconEntry, OptimizeFn } from "../../typings/types";

export interface BuildIconEntryOptions {
  collection: string;
  optimize?: OptimizeFn;
  strict?: boolean;
  logger: Pick<AstroIntegrationLogger, "warn">;
}

/**
 * Renders a single icon out of a resolved iconify pack (see `resolvePack`)
 * into an `IconEntry`, running it through `optimize` if given.
 */
export async function buildIconEntry(
  data: IconifyJSON,
  name: string,
  { collection, optimize, strict = false, logger }: BuildIconEntryOptions,
): Promise<IconEntry | undefined> {
  const iconData = getIconData(data, name);
  if (!iconData) return undefined;

  const rendered = iconToSVG(iconData);
  const svg = iconToHTML(rendered.body, rendered.attributes);

  return parseIconSVG(svg, {
    collection,
    name,
    optimize,
    strict,
    logger,
    fallbackSize: { width: rendered.viewBox[2], height: rendered.viewBox[3] },
  });
}
