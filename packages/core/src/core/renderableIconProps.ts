import type { IconEntry } from "../../typings/types";

export interface RenderableIconProps<P> {
  /** Props to spread onto the rendered `<svg>`, with `size` folded into `width`/`height`. */
  normalizedProps: Omit<P, "size">;
}

/** Builds the final `<svg>` props for a single icon occurrence. Shared by `<Icon>` and `<LiveIcon>`. */
export function renderableIconProps<
  P extends { size?: number | string; width?: unknown; height?: unknown; viewBox?: unknown },
>(
  entry: Pick<IconEntry, "width" | "height" | "viewBox">,
  props: P,
): RenderableIconProps<P> {
  const { size, ...rest } = props;
  const sized = size ? { ...rest, width: size, height: size } : rest;
  return {
    normalizedProps: {
      width: entry.width,
      height: entry.height,
      viewBox: entry.viewBox,
      ...sized,
    } as Omit<P, "size">,
  };
}
