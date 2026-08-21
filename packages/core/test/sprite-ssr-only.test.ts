import { execFile, spawn, type ChildProcess } from "node:child_process";
import { rm } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spriteSymbolId } from "../src/render/spriteMode.js";

const run = promisify(execFile);

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const fixtureRoot = join(packageRoot, "test/fixtures/sprite-ssr-only");
const astroBin = join(packageRoot, "node_modules/.bin/astro");

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, () => {
      const address = server.address();
      const port =
        typeof address === "object" && address ? address.port : undefined;
      server.close(() =>
        port
          ? resolve(port)
          : reject(new Error("Could not determine a free port")),
      );
    });
  });
}

// Astro's `generatePages()` returns before running `astro:build:generated` when nothing
// is prerendered, so an app with no prerendered route never reaches the hook the sprite
// assets used to be emitted from - and <Icon>'s SSR branch still emitted <use href> at
// them. Every icon in a fully server-rendered app rendered blank against a 404.
describe("sprite assets in an app with no prerendered routes at all", () => {
  let html = "";
  let assetHref = "";
  let assetResponse: Response;
  let server: ChildProcess;

  beforeAll(async () => {
    await run(astroBin, ["build", "--root", fixtureRoot], { cwd: packageRoot });

    const port = await getFreePort();
    server = spawn(
      process.execPath,
      [join(fixtureRoot, "dist/server/entry.mjs")],
      {
        cwd: fixtureRoot,
        env: { ...process.env, HOST: "127.0.0.1", PORT: String(port) },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () =>
          reject(
            new Error(
              "Timed out waiting for the sprite-ssr-only fixture server to start",
            ),
          ),
        15_000,
      );
      server.stdout?.on("data", (chunk: Buffer) => {
        if (chunk.toString().includes("Server listening")) {
          clearTimeout(timeout);
          resolve();
        }
      });
      server.once("error", reject);
    });

    html = await (await fetch(`http://127.0.0.1:${port}/`)).text();
    assetHref = html.match(/<use href="([^#"]+)#/)?.[1] ?? "";
    assetResponse = await fetch(`http://127.0.0.1:${port}${assetHref}`);
  }, 60_000);

  afterAll(async () => {
    server?.kill();
    await rm(join(fixtureRoot, "dist"), { recursive: true, force: true });
    await rm(join(fixtureRoot, ".astro"), { recursive: true, force: true });
  });

  it("still references a sprite asset from the SSR route", () => {
    const id = spriteSymbolId("icons", "square");
    expect(html).toMatch(
      new RegExp(`<use href="/_astro/icons\\.[0-9a-f]{8}\\.svg#${id}"`),
    );
  });

  it("emits the referenced asset, so the reference doesn't 404", () => {
    expect(assetHref).not.toBe("");
    expect(assetResponse.status).toBe(200);
    expect(assetResponse.headers.get("content-type")).toContain(
      "image/svg+xml",
    );
  });

  it("serves an asset actually containing the referenced symbol", async () => {
    const svg = await assetResponse.clone().text();
    expect(svg).toContain(`<symbol id="${spriteSymbolId("icons", "square")}"`);
    expect(svg).toContain("<rect");
  });
});
