#!/usr/bin/env node
/**
 * Audit cleaner operational lifecycle consistency (Workforce Stabilization Phase 1.5).
 *
 * Usage: npm run ops:audit:cleaner-operational-states
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvFiles, requireServiceRoleClient } from "../e2e/lib/env.mjs";
import {
  auditCleanerOperationalStates,
  loadCleanerOperationalAuditContext,
  printAuditReport,
} from "./lib/cleaner-operational-audit.mjs";

loadEnvFiles();
const client = requireServiceRoleClient(createClient);

async function main() {
  console.log("Cleaner operational state audit (Phase 1.5)\n");

  const ctx = await loadCleanerOperationalAuditContext(client);
  if (ctx.rows.length === 0) {
    console.log("PASS: no cleaner rows to audit.");
    return;
  }

  const report = auditCleanerOperationalStates(ctx);
  printAuditReport(report);

  if (report.failCount > 0) {
    process.exit(1);
  }
  if (report.warnCount > 0) {
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
