import { lookupCollection } from "@iconify/json";
import { getIconData, iconToSVG, iconToHTML, replaceIDs } from "@iconify/utils";
import etag from "etag";
import type { IconifyJSON } from "@iconify/types";
import type { VercelApiHandler } from "@vercel/node";

const packAliases = new Map([
  ["logo", "fa-brands"],
  ["radix", "radix-icons"],
]);

const handler: VercelApiHandler = async (req, res) => {
  const reqOrigin = req.headers["origin"];
  const reqEtag = req.headers["if-none-match"];
  res.setHeader("Access-Control-Allow-Origin", reqOrigin || "*");
  res.setHeader("Cache-Control", "s-maxage=59, stale-while-revalidate=299");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  let { pack, name } = req.query;
  if (!pack) {
    res.status(400).send(`Bad Request: No "pack" query param detected`);
    return;
  }
  if (Array.isArray(pack)) {
    res.status(400).send(`Bad Request: "pack" cannot be passed multiple times`);
    return;
  }
  if (Array.isArray(name)) {
    res.status(400).send(`Bad Request: "name" cannot be passed multiple times`);
    return;
  }
  if (!name && pack.includes(":")) {
    const [prefix, ...parts] = pack.split(":");
    pack = prefix;
    name = parts.join(":");
  }
  if (!pack && name?.includes(":")) {
    const [prefix, ...parts] = name.split(":");
    pack = prefix;
    name = parts.join(":");
  }

  const packAlias = packAliases.get(pack);
  if (packAlias) {
    pack = packAlias;
  }

  let collection: IconifyJSON;
  try {
    collection = await lookupCollection(pack);
  } catch (ex) {
    // TODO: fuzzy match to provide more helpful error?
    res.status(404).send(`Not Found: pack "${pack}"`);
    return;
  }

  if (!name) {
    const { icons } = collection;
    res.setHeader("Content-Type", "application/json");
    const body = JSON.stringify(Object.keys(icons));
    const resEtag = etag(body);
    if (reqEtag === resEtag) {
      res.status(304).end();
    } else {
      res.setHeader("ETag", resEtag);
      res.status(200).send(body);
    }
    return;
  }

  const data = getIconData(collection, name);
  if (!data) {
    res.status(404).send(`Not Found: "${name}" in pack "${pack}"`);
    return;
  }
  const renderData = iconToSVG(data);
  const svg = iconToHTML(replaceIDs(renderData.body), renderData.attributes);
  const resEtag = etag(svg);
  if (reqEtag === resEtag) {
    res.status(304).end();
  } else {
    res.setHeader("ETag", resEtag);
    res.setHeader("Content-Type", "image/svg+xml");
    res.status(200).send(svg);
  }
};

export default handler;
