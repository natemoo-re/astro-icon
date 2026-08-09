import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import handler from "./api/v1/icon.js";

// A minimal local stand-in for the Vercel dev runtime, just enough to run
// the existing `api/v1/icon.ts` handler outside of Vercel: parses the query
// string into `req.query` and adds the `res.status()`/`res.send()` helpers
// it expects. Not a general-purpose Vercel dev server.
function toVercelRequest(req: IncomingMessage) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const query: Record<string, string> = {};
  for (const [key, value] of url.searchParams) query[key] = value;
  return Object.assign(req, { query });
}

function toVercelResponse(res: ServerResponse) {
  return Object.assign(res, {
    status(code: number) {
      res.statusCode = code;
      return this;
    },
    send(body: unknown) {
      res.end(typeof body === "string" ? body : JSON.stringify(body));
      return this;
    },
  });
}

const port = Number(process.env.PORT ?? 3001);

createServer((req, res) => {
  Promise.resolve(
    handler(toVercelRequest(req) as any, toVercelResponse(res) as any),
  ).catch((err) => {
    console.error(err);
    if (!res.headersSent) res.writeHead(500);
    res.end("Internal Server Error");
  });
}).listen(port, () => {
  console.log(`[service] listening on http://localhost:${port}`);
});
