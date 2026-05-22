#!/usr/bin/env node
/**
 * Render support notification templates with fixture payloads (no email send).
 *
 * Usage: npm run ops:test:support-notifications
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = join(fileURLToPath(new URL("../..", import.meta.url)));

process.env.APP_BASE_URL = process.env.APP_BASE_URL ?? "https://app.example.com";
process.env.WRITE_SUPPORT_PREVIEWS = "1";

const result = spawnSync(
  "npx",
  [
    "vitest",
    "run",
    "src/features/support/server/supportNotificationRenderPreview.test.ts",
    "--reporter=verbose",
  ],
  {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: process.env,
  },
);

process.exit(result.status ?? 1);
