import { defineCollection } from "astro:content";
import { createIconLoader } from "astro-icon/loaders";
import type { IconSource } from "astro-icon/loaders";

const source: IconSource = {
  name: "test-icons",
  async getIcon(name) {
    const bodies: Record<string, string> = {
      square: '<rect x="4" y="4" width="16" height="16"/>',
      circle: '<circle cx="12" cy="12" r="8"/>',
    };
    if (!(name in bodies)) throw new Error(`no icon named "${name}"`);
    return { body: bodies[name], viewBox: "0 0 24 24", width: 24, height: 24 };
  },
  async listIcons() {
    return ["square", "circle"];
  },
};

export const collections = {
  icons: defineCollection({ loader: createIconLoader(source) }),
};
