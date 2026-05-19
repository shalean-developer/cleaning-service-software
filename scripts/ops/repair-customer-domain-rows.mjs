#!/usr/bin/env node
/**
 * Phase 1B: repair customer profiles missing customers rows (REPAIR findings only).
 *
 * Safety:
 *   - Default dry-run (no writes)
 *   - --apply requires CONFIRM_REPAIR_CUSTOMER_DOMAIN=yes
 *   - Only calls ensure_customer_provisioned(profile_id) for REPAIR rows
 *   - Does not delete REVIEW stray rows, touch bookings, auth.users, or profile roles
 *
 * Usage:
 *   npm run ops:repair:customer-domain
 *   CONFIRM_REPAIR_CUSTOMER_DOMAIN=yes npm run ops:repair:customer-domain -- --apply
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvFiles, requireServiceRoleClient } from "../e2e/lib/env.mjs";
import {
  buildReviewCleanupPlan,
  printAuditSummary,
  printReviewCleanupPlan,
  runCustomerDomainAudit,
} from "./lib/customer-domain-audit.mjs";

const args = process.argv.slice(2);
const applyRequested = args.includes("--apply");
const confirmed = process.env.CONFIRM_REPAIR_CUSTOMER_DOMAIN === "yes";

loadEnvFiles();
const client = requireServiceRoleClient(createClient);

function usage() {
  console.log(`Customer domain repair (REPAIR findings only)

Usage:
  npm run ops:repair:customer-domain
  CONFIRM_REPAIR_CUSTOMER_DOMAIN=yes npm run ops:repair:customer-domain -- --apply

Flags:
  --apply    Apply ensure_customer_provisioned for REPAIR profiles (requires confirm env)
  --help     Show this message

Safety:
  - Default: dry-run
  - Does not delete REVIEW stray rows or modify bookings / auth.users / roles
  - Prints before/after audit summary and REVIEW cleanup plan (no deletes)`);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} profileId
 */
async function provisionCustomerRow(client, profileId) {
  const { data: customerId, error } = await client.rpc("ensure_customer_provisioned", {
    profile_id: profileId,
  });
  if (error) throw error;
  if (!customerId) {
    throw new Error(
      `ensure_customer_provisioned returned null for profile ${profileId} — profile may not be role=customer`,
    );
  }
  return customerId;
}

async function main() {
  if (args.includes("--help") || args.includes("-h")) {
    usage();
    return;
  }

  if (applyRequested && !confirmed) {
    console.error(
      "Error: --apply requires CONFIRM_REPAIR_CUSTOMER_DOMAIN=yes\n" +
        "Example:\n" +
        "  CONFIRM_REPAIR_CUSTOMER_DOMAIN=yes npm run ops:repair:customer-domain -- --apply",
    );
    process.exit(1);
  }

  const dryRun = !applyRequested || !confirmed;
  console.log(
    dryRun
      ? "Customer domain repair (dry-run — no writes)\n"
      : "Customer domain repair (apply mode)\n",
  );

  const before = await runCustomerDomainAudit(client);
  printAuditSummary(before.summary, "Before");

  const repairTargets = before.findings.filter((f) => f.action === "REPAIR");

  if (repairTargets.length === 0) {
    console.log("\nNo REPAIR findings — nothing to provision.");
  } else {
    console.log(`\nREPAIR targets (${repairTargets.length}):`);
    for (const row of repairTargets) {
      console.log(`  ${row.email}  profile_id=${row.profileId}`);
    }

    if (dryRun) {
      console.log("\n[dry-run] Would call ensure_customer_provisioned for each REPAIR profile.");
      console.log(
        "Set CONFIRM_REPAIR_CUSTOMER_DOMAIN=yes and pass --apply to provision customers rows.",
      );
    } else {
      console.log("\nApplying ensure_customer_provisioned…");
      for (const row of repairTargets) {
        const customerId = await provisionCustomerRow(client, row.profileId);
        console.log(`  ✓ ${row.email} → customers.id=${customerId}`);
      }
    }
  }

  if (before.summary.unsafe > 0 || before.summary.orphanCustomerRows > 0) {
    console.warn(
      "\nWarning: UNSAFE or orphan customer rows present — repair script does not modify them.",
    );
  }

  const reviewPlanBefore = buildReviewCleanupPlan(before.findings);
  printReviewCleanupPlan(reviewPlanBefore);

  if (!dryRun) {
    const after = await runCustomerDomainAudit(client);
    printAuditSummary(after.summary, "After");

    const reviewPlanAfter = buildReviewCleanupPlan(after.findings);
    if (reviewPlanAfter.length !== reviewPlanBefore.length) {
      printReviewCleanupPlan(reviewPlanAfter);
    }

    if (after.summary.repair > 0) {
      console.error("\nError: REPAIR findings remain after apply — verify RPC and profile roles.");
      process.exit(1);
    }
    if (after.summary.unsafe > 0) {
      console.error("\nError: UNSAFE findings present — stop before hardening migration.");
      process.exit(1);
    }
  } else if (repairTargets.length > 0) {
    console.log("\nAfter apply, re-run: npm run ops:audit:customer-domain");
    console.log("Expected: REPAIR=0, REVIEW unchanged, UNSAFE=0");
  }

  console.log("\nReference:");
  console.log("  docs/operations/customer-domain-reconciliation-hardening-plan.md");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
