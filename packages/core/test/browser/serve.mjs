// Minimal static file server for the browser test's built fixture.
// `astro preview` isn't used here: this Astro build's preview/dev commands
// daemonize themselves (background process, wrapper exits immediately),
// which Playwright's webServer orchestration reads as "failed to start" -
// it expects a plain foreground process it can spawn and kill directly.
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../fixtures/sprite-browser/dist/", import.meta.url));
const port = Number(process.argv[2] ?? 4322);

const CONTENT_TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  let path = join(root, decodeURIComponent(url.pathname));
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, "index.html");
  if (!existsSync(path) && !extname(path)) path = `${path}.html`;

  if (!existsSync(path)) {
    res.writeHead(404).end("Not found");
    return;
  }

  res.setHeader("Content-Type", CONTENT_TYPES[extname(path)] ?? "application/octet-stream");
  createReadStream(path).pipe(res);
}).listen(port, () => {
  console.log(`Serving ${root} on http://localhost:${port}`);
});
