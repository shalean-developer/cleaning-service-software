#!/usr/bin/env node
/**
 * Backfill notification_metrics_hourly for the last 168 closed UTC hours.
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Run: npm run ops:backfill:notification-metrics
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFiles } from "../e2e/lib/env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");

loadEnvFiles();

const hours = process.env.NOTIFICATION_METRICS_BACKFILL_HOURS ?? "168";

console.log(`Backfilling notification metrics for up to ${hours} closed hours...\n`);

const result = spawnSync(
  "npx",
  ["vitest", "run", "src/scripts/backfillNotificationMetricsHourly.cli.test.ts"],
  {
    cwd: root,
    env: {
      ...process.env,
      NOTIFICATION_METRICS_BACKFILL_CLI: "1",
      NOTIFICATION_METRICS_BACKFILL_HOURS: hours,
    },
    stdio: "inherit",
    shell: true,
  },
);

process.exit(typeof result.status === "number" ? result.status : 1);
