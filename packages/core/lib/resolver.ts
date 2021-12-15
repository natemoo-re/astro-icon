const baseURL = "https://api.astroicon.dev/v1/";
const requests = new Map();
const fetchCache = new Map();

// Default resolver fetches icons from `api.astroicon.dev`
export default async function get(pack: string, name: string) {
  const url = new URL(`./${pack}/${name}`, baseURL).toString();
  // Handle in-flight requests
  if (requests.has(url)) {
    return await requests.get(url);
  }
  if (fetchCache.has(url)) {
    return fetchCache.get(url);
  }

  let request = async () => {
    const res = await fetch(url);
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
  };
  let promise = request();
  requests.set(url, promise);
  return await promise;
}
