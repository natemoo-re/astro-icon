import { VercelApiHandler } from "@vercel/node";
import { Collection, SVG } from "@iconify/json-tools";

const packAliases = new Map([
  ["logo", "fa-brands"],
  ["radix", "radix-icons"],
]);

const handler: VercelApiHandler = async (req, res) => {
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

  if (packAliases.has(pack)) {
    pack = packAliases.get(pack);
  }

  let collection = new Collection();
  if (!collection.loadIconifyCollection(pack)) {
    // TODO: fuzzy match to provide more helpful error?
    res.status(404).send(`Not Found: pack "${pack}"`);
    return;
  }

  if (!name) {
    const icons = collection.getIcons();
    res.setHeader("Content-Type", "application/json");
    res.status(200).send(JSON.stringify(Object.keys(icons.icons)));
    return;
  }

  const data = collection.getIconData(name);
  if (!data) {
    res.status(404).send(`Not Found: "${name}" in pack "${pack}"`);
    return;
  }
  const svg = new SVG(data).getSVG({});

  res.setHeader("Content-Type", "image/svg+xml");
  res.status(200).send(svg);
};

export default handler;
