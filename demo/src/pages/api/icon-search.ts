import type { APIRoute } from "astro";
import { getLiveEntry } from "astro:content";

const RESULT_LIMIT = 12;
const PACKS = ["mdi", "ph"] as const;
type Pack = (typeof PACKS)[number];

interface IconResult {
  name: string;
  body: string;
  viewBox: string;
  width: number;
  height: number;
}

// Backs the client-side debounced search on /palette/, which also works server-side without JS.
// `pack` selects which live collection (src/live.config.ts) to resolve results from: "mdi" is
// installed locally, "ph" isn't, so it falls back to the Iconify API per icon.
export const GET: APIRoute = async ({ url }) => {
  const query = url.searchParams.get("q")?.trim() ?? "";
  const packParam = url.searchParams.get("pack") ?? "mdi";
  const pack: Pack = PACKS.includes(packParam as Pack) ? (packParam as Pack) : "mdi";

  if (!query) {
    return Response.json({ results: [] satisfies IconResult[] });
  }

  const searchRes = await fetch(
    `https://api.iconify.design/search?query=${encodeURIComponent(query)}&prefix=${pack}&limit=${RESULT_LIMIT}`,
  ).catch(() => undefined);

  if (!searchRes || !searchRes.ok) {
    return Response.json(
      {
        results: [],
        error: `Iconify search returned ${searchRes?.status ?? "an error"}.`,
      },
      { status: 502 },
    );
  }

  const data = (await searchRes.json()) as { icons: string[] };
  const names = data.icons.slice(0, RESULT_LIMIT);

  const resolved = await Promise.all(
    names.map(async (fullName): Promise<IconResult | undefined> => {
      const iconName = fullName.startsWith(`${pack}:`) ? fullName.slice(pack.length + 1) : fullName;
      const { entry, error } = await getLiveEntry(pack, iconName);
      if (error || !entry) return undefined;
      const icon = entry.data as { body: string; viewBox: string; width: number; height: number };
      return { name: `${pack}:${iconName}`, ...icon };
    }),
  );

  return Response.json({
    results: resolved.filter((icon) => icon !== undefined),
  });
};
