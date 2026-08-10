import type { IconEntry } from "../../typings/types";
import { iconId, type ParsedName } from "./parseName.js";

export interface RenderableIconProps<P> {
  /** Shared by an icon's `<symbol>` (if any) and its `<use>`/inline body. */
  id: string;
  /**
   * Props to spread onto the rendered `<svg>` - `size` folded into
   * `width`/`height`, `viewBox`/`width`/`height` defaulted from `entry`
   * unless the caller's own props already set them.
   */
  normalizedProps: Omit<P, "size">;
}

/**
 * Builds the `id` and the final `<svg>` props for a single icon occurrence.
 * Shared by `<Icon>` and `<LiveIcon>` so "size wins over an explicit
 * width/height, viewBox/width/height default from the resolved entry" is
 * defined once instead of copy-pasted into both components' frontmatter.
 */
export function renderableIconProps<
  P extends { size?: number | string; width?: unknown; height?: unknown; viewBox?: unknown },
>(
  entry: Pick<IconEntry, "width" | "height" | "viewBox">,
  { collection, name }: Pick<ParsedName, "collection" | "name">,
  props: P,
): RenderableIconProps<P> {
  const { size, ...rest } = props;
  const sized = size ? { ...rest, width: size, height: size } : rest;
  return {
    id: iconId(collection, name),
    normalizedProps: {
      width: entry.width,
      height: entry.height,
      viewBox: entry.viewBox,
      ...sized,
    } as Omit<P, "size">,
  };
}
