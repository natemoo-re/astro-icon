import { execFile, spawn, type ChildProcess } from "node:child_process";
import { rm } from "node:fs/promises";
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
      const port = typeof address === "object" && address ? address.port : undefined;
      server.close(() => (port ? resolve(port) : reject(new Error("Could not determine a free port"))));
    });
  });
}

describe("iconifyLive() + <LiveIcon> against a real astro server build", () => {
  let server: ChildProcess;
  let html = "";

  beforeAll(async () => {
    await run(astroBin, ["build", "--root", fixtureRoot], {
      cwd: packageRoot,
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
        () => reject(new Error("Timed out waiting for the live fixture server to start")),
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

  it("degrades a missing live icon to nothing instead of crashing the page", () => {
    expect(html).not.toContain("does-not-exist");
    expect(html).toContain("<body>");
    expect(html).toContain("</body>");
  });
});
