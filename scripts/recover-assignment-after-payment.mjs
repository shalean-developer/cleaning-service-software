#!/usr/bin/env node
/**
 * Recover paid bookings stuck in `confirmed` without assignment dispatch (O1).
 *
 * Default: dry-run (discovery only).
 * Apply: CONFIRM_ASSIGNMENT_RECOVERY=yes npm run ops:recover:assignments
 *
 * Alternative: POST /api/cron/recover-assignment-after-payment with CRON_SECRET.
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFiles } from "./e2e/lib/env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

loadEnvFiles();

const apply = process.env.CONFIRM_ASSIGNMENT_RECOVERY === "yes";

if (apply) {
  console.log("CONFIRM_ASSIGNMENT_RECOVERY=yes — applying assignment recovery.\n");
} else {
  console.log("Dry-run mode (default). No writes.\n");
}

const env = {
  ...process.env,
  ASSIGNMENT_RECOVERY_CLI: "1",
  ASSIGNMENT_RECOVERY_DRY_RUN: apply ? "0" : "1",
  BOOKING_COMMAND_BACKEND: process.env.BOOKING_COMMAND_BACKEND ?? "supabase",
};

const result = spawnSync(
  "npx",
  ["vitest", "run", "src/scripts/recoverAssignmentAfterPayment.cli.test.ts"],
  {
    cwd: root,
    env,
    stdio: "inherit",
    shell: true,
  },
);

process.exit(typeof result.status === "number" ? result.status : 1);
