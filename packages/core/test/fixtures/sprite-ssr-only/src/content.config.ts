import { defineCollection } from "astro:content";
import { createIconLoader } from "astro-icon/loaders";
import type { IconSource } from "astro-icon/loaders";

const squareSource: IconSource = {
  name: "squares",
  async getIcon(name) {
    if (name !== "square") throw new Error(`no icon named "${name}"`);
    return {
      body: '<rect x="4" y="4" width="16" height="16"/>',
      viewBox: "0 0 24 24",
      width: 24,
      height: 24,
    };
  },
  async listIcons() {
    return ["square"];
  },
};

export const collections = {
  icons: defineCollection({ loader: createIconLoader(squareSource) }),
};
