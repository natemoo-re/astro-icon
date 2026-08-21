import { execFile, spawn, type ChildProcess } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spriteSymbolId } from "../src/render/spriteMode.js";

const run = promisify(execFile);

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const fixtureRoot = join(packageRoot, "test/fixtures/sprite-integration");
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

describe("the sprite integration + <Icon> against a real astro build (hybrid rendering)", () => {
  let prerenderedHtml = "";
  let ssrHtml = "";
  let assetHref = "";
  let server: ChildProcess;
  let assetResponse: Response;

  beforeAll(async () => {
    await run(astroBin, ["build", "--root", fixtureRoot], { cwd: packageRoot });

    prerenderedHtml = await readFile(
      join(fixtureRoot, "dist/client/index.html"),
      "utf-8",
    );

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
              "Timed out waiting for the sprite-integration fixture server to start",
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

    const res = await fetch(`http://127.0.0.1:${port}/ssr`);
    ssrHtml = await res.text();

    assetHref = ssrHtml.match(/<use href="([^#"]+)#/)?.[1] ?? "";
    assetResponse = await fetch(`http://127.0.0.1:${port}${assetHref}`);
  }, 60_000);

  afterAll(async () => {
    server?.kill();
    await rm(join(fixtureRoot, "dist"), { recursive: true, force: true });
    await rm(join(fixtureRoot, ".astro"), { recursive: true, force: true });
  });

  it("dedupes a sprite-eligible icon repeated on a prerendered page into one <symbol> + <use>s", () => {
    const id = spriteSymbolId("icons", "square");
    expect(prerenderedHtml.match(/<symbol/g)).toHaveLength(1);
    expect(prerenderedHtml).toContain(`<symbol id="${id}"`);
    expect(
      prerenderedHtml.match(new RegExp(`<use href="#${id}">`, "g")),
    ).toHaveLength(2);
  });

  it("places the <symbol> defs block before any <use> - no forward reference", () => {
    expect(prerenderedHtml.indexOf("<symbol")).toBeLessThan(
      prerenderedHtml.indexOf("<use"),
    );
  });

  it("leaves the inline-opted-out third usage as a full body, untouched by the rewrite", () => {
    expect(prerenderedHtml).toContain("<rect");
    expect(prerenderedHtml).toContain("data-icon-inline");
  });

  it("references the sprite asset by a real content hash, not the step-1 placeholder", () => {
    const id = spriteSymbolId("icons", "square");
    expect(ssrHtml).toMatch(
      new RegExp(`<use href="/_astro/icons\\.[0-9a-f]{8}\\.svg#${id}"`),
    );
    // The placeholder from step 1 was literally the collection name as the hash.
    expect(ssrHtml).not.toContain("/_astro/icons.icons.svg");
  });

  it("respects the inline prop even on an SSR route, rendering the full body instead of a reference", () => {
    // Two <Icon name="square" /> usages on /ssr: the first sprited (<use>), the second `inline`.
    expect(ssrHtml).toContain("<rect");
    expect(ssrHtml).toContain("data-icon-inline");
  });

  it("path agreement: the href <Icon> emits resolves to a real, correctly-typed asset the integration actually emitted", () => {
    expect(assetResponse.status).toBe(200);
    expect(assetResponse.headers.get("content-type")).toContain(
      "image/svg+xml",
    );
  });

  it("the served asset contains the exact icon referenced, as a <symbol> matching the <use>'s id", async () => {
    const svg = await assetResponse.clone().text();
    const id = spriteSymbolId("icons", "square");
    expect(svg).toContain(`<symbol id="${id}"`);
    expect(svg).toContain("<rect");
  });
});
