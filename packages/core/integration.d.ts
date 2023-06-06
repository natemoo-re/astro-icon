import { AstroIntegration } from "astro";

export interface AstroIconOptions {
  include: Record<string, ["*"] | string[]>;
}

export type Icon = string;

export default function icon(opts: AstroIconOptions): AstroIntegration;
