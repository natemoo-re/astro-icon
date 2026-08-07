import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import loadLocalCollection from "../dist/loaders/loadLocalCollection.js";

test("local collections are deterministic", async () => {
  const directory = await mkdtemp(join(tmpdir(), "astro-icon-"));
  try {
    await writeFile(
      join(directory, "example.svg"),
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>',
    );

    const first = await loadLocalCollection(directory);
    const second = await loadLocalCollection(directory);

    assert.deepEqual(first, second);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
