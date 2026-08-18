#!/usr/bin/env node
// Publishes astro-icon via the npm CLI directly (not `changeset publish`), so
// that npm's OIDC trusted-publishing support is used instead of delegating
// through pnpm, which the workspace's pnpm-workspace.yaml otherwise forces
// `@changesets/cli` to do. Git tagging still goes through `changeset git-tag`,
// which only touches git locally and reports to $CHANGESETS_OUTPUT for
// changesets/action to pick up.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const packageDir = "packages/core";
const pkg = JSON.parse(readFileSync(`${packageDir}/package.json`, "utf8"));
const { name, version } = pkg;

let alreadyPublished = true;
try {
  execFileSync("npm", ["view", `${name}@${version}`, "version"], { stdio: "pipe" });
} catch {
  alreadyPublished = false;
}

if (alreadyPublished) {
  console.log(`${name}@${version} is already published, skipping.`);
} else {
  console.log(`Publishing ${name}@${version}...`);
  execFileSync("npm", ["publish"], { cwd: packageDir, stdio: "inherit" });
}

execFileSync("pnpm", ["exec", "changeset", "git-tag"], { stdio: "inherit" });
