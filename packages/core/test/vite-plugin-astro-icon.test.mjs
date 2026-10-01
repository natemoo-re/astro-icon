import assert from "node:assert/strict";
import { test } from "node:test";
import { join, posix, resolve, sep, win32 } from "node:path";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createPlugin } from "../dist/vite-plugin-astro-icon.js";

test("the old pathname implementation creates an invalid Windows path", () => {
  const windowsRootUrl = new URL("file:///C:/project/");
  const oldPath = win32.resolve(windowsRootUrl.pathname, "src/icons");

  assert.notEqual(oldPath, win32.resolve("C:\\project", "src/icons"));
  assert.match(oldPath, /\\C:\\project\\src\\icons$/);
});

test("file URLs resolve to native paths for both platform conventions", () => {
  const windowsRoot = new URL("file:///C:/project/");
  const posixRoot = new URL("file:///tmp/project/");

  assert.equal(
    win32.resolve(fileURLToPath(windowsRoot, { windows: true }), "src/icons"),
    "C:\\project\\src\\icons",
  );
  assert.equal(
    posix.resolve(fileURLToPath(posixRoot, { windows: false }), "src/icons"),
    "/tmp/project/src/icons",
  );
});

test("the plugin registers a native filesystem path on every platform", () => {
  const root = pathToFileURL(`${resolve("project")}${sep}`);
  const expectedPath = resolve(fileURLToPath(root), "src/icons");
  let watchedPath;

  const plugin = createPlugin({}, { root, output: "static", logger: {} });
  plugin.configureServer({
    watcher: {
      add(path) {
        watchedPath = path;
      },
      on() {},
    },
    moduleGraph: {},
  });

  assert.equal(watchedPath, expectedPath);
});

test("the plugin ignores SVG files in sibling directories", async () => {
  let onAll;
  let invalidated = false;
  const root = pathToFileURL(`${resolve("project")}${sep}`);

  const plugin = createPlugin({}, { root, output: "static", logger: {} });
  plugin.configureServer({
    watcher: {
      add() {},
      on(event, handler) {
        if (event === "all") onAll = handler;
      },
    },
    moduleGraph: {
      invalidateAll() {
        invalidated = true;
      },
    },
  });

  await onAll("add", resolve("project", "src", "icons-2", "icon.svg"));

  assert.equal(invalidated, false);
});

test("the plugin reloads SVG files in the icon directory", async () => {
  const projectPath = await mkdtemp(join(tmpdir(), "astro-icon-test-"));
  const iconDir = join(projectPath, "src", "icons");
  await mkdir(iconDir, { recursive: true });
  await writeFile(
    join(iconDir, "icon.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>',
  );

  let onAll;
  let invalidated = false;
  const root = pathToFileURL(`${projectPath}${sep}`);
  const plugin = createPlugin(
    { iconDir },
    { root, output: "static", logger: { info() {}, warn() {} } },
  );
  plugin.configureServer({
    watcher: {
      add() {},
      on(event, handler) {
        if (event === "all") onAll = handler;
      },
    },
    moduleGraph: {
      invalidateAll() {
        invalidated = true;
      },
    },
  });

  try {
    await onAll("add", join(iconDir, "icon.svg"));
    assert.equal(invalidated, true);
  } finally {
    await rm(projectPath, { recursive: true, force: true });
  }
});
