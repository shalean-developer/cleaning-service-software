#!/usr/bin/env node
/**
 * Read-only audit: customer domain row reconciliation.
 *
 * Detects:
 *   - customers rows where profiles.role != customer
 *   - profiles.role = customer without a customers row
 *   - profiles with both customers and cleaners rows
 *   - duplicate customers.profile_id mappings (integrity violation)
 *
 * Safety:
 *   - Default dry-run (no writes; --apply is rejected — use repair script)
 *   - service_role required
 *
 * Usage:
 *   npm run ops:audit:customer-domain
 *   npm run ops:audit:customer-domain -- --json
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvFiles, requireServiceRoleClient } from "../e2e/lib/env.mjs";
import { runCustomerDomainAudit } from "./lib/customer-domain-audit.mjs";

const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");
const applyRequested = args.includes("--apply");

loadEnvFiles();
const client = requireServiceRoleClient(createClient);

function pad(value, width) {
  const text = String(value ?? "");
  return text.length >= width ? text : text.padEnd(width);
}

function usage() {
  console.log(`Customer domain reconciliation audit (read-only)

Usage:
  npm run ops:audit:customer-domain
  npm run ops:audit:customer-domain -- --json

Flags:
  --json     Machine-readable output
  --apply    Not supported — use npm run ops:repair:customer-domain -- --apply
  --help     Show this message`);
}

async function main() {
  if (args.includes("--help") || args.includes("-h")) {
    usage();
    return;
  }

  if (applyRequested) {
    console.error(
      "Error: --apply is not supported on the audit script.\n" +
        "Use: CONFIRM_REPAIR_CUSTOMER_DOMAIN=yes npm run ops:repair:customer-domain -- --apply",
    );
    process.exit(1);
  }

  const { findings: sorted, orphanCustomerRows, summary } = await runCustomerDomainAudit(client);
  summary.dryRun = true;

  if (jsonOutput) {
    console.log(
      JSON.stringify(
        {
          summary,
          findings: sorted,
          orphanCustomerRows,
        },
        null,
        2,
      ),
    );
  } else {
    console.log("Customer domain reconciliation audit (dry-run — no writes)\n");

    const headers = [
      "action",
      "role",
      "email",
      "profile_id",
      "customer_id",
      "cleaner_id",
      "bookings",
      "issues",
    ];
    const widths = [8, 8, 36, 38, 38, 38, 8, 48];

    console.log(headers.map((h, i) => pad(h, widths[i])).join(" | "));
    console.log("-".repeat(widths.reduce((a, b) => a + b + 3, 0)));

    for (const row of sorted) {
      if (row.action === "KEEP") continue;
      console.log(
        [
          pad(row.action, widths[0]),
          pad(row.role, widths[1]),
          pad(row.email, widths[2]),
          pad(row.profileId, widths[3]),
          pad(row.customerId ?? "-", widths[4]),
          pad(row.cleanerId ?? "-", widths[5]),
          pad(row.bookingCount, widths[6]),
          pad(row.issueCodes.join(",") || "-", widths[7]),
        ].join(" | "),
      );
    }

    const keepCount = summary.keep;
    if (keepCount > 0) {
      console.log(`\n(${keepCount} profile(s) classified KEEP — omitted from table)`);
    }

    if (orphanCustomerRows.length > 0) {
      console.log("\nOrphan customers rows (no profiles row):");
      for (const row of orphanCustomerRows) {
        console.log(`  UNSAFE  customer_id=${row.customerId}  profile_id=${row.profileId}`);
      }
    }

    console.log("\nSummary:");
    console.log(`  KEEP:   ${summary.keep}`);
    console.log(`  REPAIR: ${summary.repair}`);
    console.log(`  REVIEW: ${summary.review}`);
    console.log(`  UNSAFE: ${summary.unsafe}`);
    if (summary.orphanCustomerRows > 0) {
      console.log(`  Orphan customers rows: ${summary.orphanCustomerRows}`);
    }

    const actionable = sorted.filter((f) => f.action !== "KEEP");
    if (actionable.length > 0) {
      console.log("\nSuggested next steps:");
      for (const row of actionable) {
        console.log(`  [${row.action}] ${row.email}`);
        console.log(`    issues: ${row.issueCodes.join(", ")}`);
        if (row.repairHint) console.log(`    hint:   ${row.repairHint}`);
      }
    }

    if (summary.repair > 0) {
      console.log("\nRepair (after ops sign-off):");
      console.log(
        "  CONFIRM_REPAIR_CUSTOMER_DOMAIN=yes npm run ops:repair:customer-domain -- --apply",
      );
    }

    console.log("\nReference:");
    console.log("  docs/operations/customer-domain-reconciliation-hardening-plan.md");
  }

  const exitNonZero =
    summary.repair > 0 || summary.review > 0 || summary.unsafe > 0 || summary.orphanCustomerRows > 0;
  process.exit(exitNonZero ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
