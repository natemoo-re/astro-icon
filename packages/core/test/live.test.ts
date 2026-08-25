import { execFile, spawn, type ChildProcess } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const run = promisify(execFile);

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const fixtureRoot = join(packageRoot, "test/fixtures/live");
const astroBin = join(packageRoot, "node_modules/.bin/astro");

/**
 * A hardcoded port collides too easily with an unrelated Astro dev server
 * (or a second one, once the first's default port is taken) running
 * elsewhere on the same machine - ask the OS for a free one instead.
 */
async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, () => {
      const address = server.address();
      const port =
        address != null && Object.prototype.hasOwnProperty.call(address, "port")
          ? (address as { port: number }).port
          : undefined;
      server.close(() =>
        port
          ? resolve(port)
          : reject(new Error("Could not determine a free port")),
      );
    });
  });
}

describe("createLiveIconLoader(iconify()) + <LiveIcon> against a real astro server build", () => {
  let server: ChildProcess;
  let html = "";

  beforeAll(async () => {
    // `cwd` matches `--root`: the fixture's `live.config.ts` runs construction-time typegen
    // rooted at a `process.cwd()` guess (see `guessProjectRoot`), so a mismatched cwd would
    // write the fixture's declaration files into this package's own `.astro/` instead.
    await run(astroBin, ["build", "--root", fixtureRoot], {
      cwd: fixtureRoot,
    });

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
            new Error("Timed out waiting for the live fixture server to start"),
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

    const res = await fetch(`http://127.0.0.1:${port}/`);
    html = await res.text();
  }, 60_000);

  afterAll(async () => {
    server?.kill();
    await rm(join(fixtureRoot, "dist"), { recursive: true, force: true });
    await rm(join(fixtureRoot, ".astro"), { recursive: true, force: true });
  });

  it("renders a live-fetched icon inline with its viewBox", () => {
    expect(html).toContain('data-icon="spinners:3-dots-fade"');
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('<circle cx="4" cy="12" r="3" fill="currentColor">');
  });

  it("gives each occurrence of a repeated live icon distinct internal ids, so <animate> timing refs don't cross-reference another instance", () => {
    const svgBlocks =
      html.match(
        /<svg[^>]*data-icon="spinners:3-dots-fade"[^>]*>[\s\S]*?<\/svg>/g,
      ) ?? [];
    expect(svgBlocks.length).toBe(2);

    const allIds = svgBlocks.flatMap((block) =>
      [...block.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]),
    );
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("generates LiveCollectionName types keyed by the registered collection key, not source.name", async () => {
    // The live loader has no project root to record typegen against, so it uses its process
    // cwd. This fixture is `output: "server"`, so `live.config.ts` only evaluates once the
    // runtime server starts - in `fixtureRoot`, per the spawn above - and the write is
    // fire-and-forget, hence the brief retry.
    const partialPath = join(
      fixtureRoot,
      ".astro/astro-icon/live-spinners.d.ts",
    );
    let partial: string | undefined;
    for (let attempt = 0; attempt < 20 && partial === undefined; attempt++) {
      partial = await readFile(partialPath, "utf-8").catch(() => undefined);
      if (partial === undefined)
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    expect(partial).toContain('"spinners"');
  });

  it("degrades a missing live icon to nothing instead of crashing the page", () => {
    expect(html).not.toContain("does-not-exist");
    expect(html).toContain("<body>");
    expect(html).toContain("</body>");
  });
});
