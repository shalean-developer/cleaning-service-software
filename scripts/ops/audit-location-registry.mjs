#!/usr/bin/env node
/**
 * Location registry operational audit.
 *
 * Usage: npm run ops:audit:location-registry
 */
import { spawnSync } from "node:child_process";

const result = spawnSync(
  "npx",
  ["vitest", "run", "src/features/locations/locationRegistry.audit.test.ts", "--reporter=dot"],
  { stdio: "inherit", shell: true, cwd: process.cwd() },
);

process.exit(result.status === 0 ? 0 : result.status ?? 1);
