const baseURL = "https://api.astroicon.dev/v1/";
const requests = new Map();
const fetchCache = new Map();

// Default resolver fetches icons from `api.astroicon.dev`
export default async function get(pack: string, name: string) {
  const url = new URL(`./${pack}/${name}`, baseURL).toString();
  // Handle in-flight requests
  if (requests.has(url)) {
    await requests.get(url);
    return fetchCache.get(url);
  }

  if (fetchCache.has(url)) {
    return fetchCache.get(url);
  }
  let request = fetch(url);
  requests.set(url, request);
  const res = await request;
  if (!res.ok) {
    throw new Error(await res.text());
  }
  const contentType = res.headers.get("Content-Type");
  if (!contentType.includes("svg")) {
    throw new Error(`[astro-icon] Unable to load "${name}" because it did not resolve to an SVG!

Recieved the following "Content-Type":
${contentType}`);
  }
  const svg = await res.text();
  fetchCache.set(url, svg);
  requests.delete(url);
  return svg;
}
