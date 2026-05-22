#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);

const npx = process.platform === "win32" ? "npx.cmd" : "npx";

const result = spawnSync(
  npx,
  ["--yes", "tsx", "scripts/import/link-cleaner-auth.ts", ...args],
  { cwd: root, stdio: "inherit", shell: false, env: process.env },
);

if (result.error) {
  console.error(result.error);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
