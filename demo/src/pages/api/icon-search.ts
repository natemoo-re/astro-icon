import type { APIRoute } from "astro";
import { getLiveEntry } from "astro:content";

const RESULT_LIMIT = 12;
const PACK = "mdi";

interface IconResult {
  name: `${typeof PACK}:${string}`;
  body: string;
  viewBox: string;
  width: number;
  height: number;
}

// Backs the client-side debounced search on /search/ - the page itself
// still works without JS (it does the same search server-side on submit),
// this just lets the client re-search on every keystroke without a full
// page reload.
export const GET: APIRoute = async ({ url }) => {
  const query = url.searchParams.get("q")?.trim() ?? "";
  if (!query) {
    return Response.json({ results: [] satisfies IconResult[] });
  }

  const searchRes = await fetch(
    `https://api.iconify.design/search?query=${encodeURIComponent(query)}&prefix=${PACK}&limit=${RESULT_LIMIT}`,
  ).catch(() => undefined);

  if (!searchRes || !searchRes.ok) {
    return Response.json(
      { results: [], error: `Iconify search returned ${searchRes?.status ?? "an error"}.` },
      { status: 502 },
    );
  }

  const data = (await searchRes.json()) as { icons: string[] };
  const names = data.icons.slice(0, RESULT_LIMIT);

  const resolved = await Promise.all(
    names.map(async (fullName): Promise<IconResult | undefined> => {
      const iconName = fullName.startsWith(`${PACK}:`) ? fullName.slice(PACK.length + 1) : fullName;
      const { entry, error } = await getLiveEntry(PACK, iconName);
      if (error || !entry) return undefined;
      const icon = entry.data as { body: string; viewBox: string; width: number; height: number };
      return { name: `${PACK}:${iconName}`, ...icon };
    }),
  );

  return Response.json({ results: resolved.filter((icon) => icon !== undefined) });
};
