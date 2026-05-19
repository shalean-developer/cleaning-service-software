#!/usr/bin/env node
/**
 * Phase 1C: delete stray customers rows on non-customer profiles (zero bookings only).
 *
 * Safety:
 *   - Default dry-run (no writes)
 *   - --apply requires CONFIRM_CLEANUP_CUSTOMER_DOMAIN=yes
 *   - Deletes customers rows only (never auth.users, profiles, roles, bookings, cleaners)
 *   - Hard-protects admin@shalean.co.za from profile/auth changes (stray customers row OK)
 *
 * Usage:
 *   npm run ops:cleanup:customer-domain
 *   CONFIRM_CLEANUP_CUSTOMER_DOMAIN=yes npm run ops:cleanup:customer-domain -- --apply
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvFiles, requireServiceRoleClient } from "../e2e/lib/env.mjs";
import {
  buildBlockedStrayCustomerRows,
  buildStrayCustomerDeletionTargets,
  printAuditSummary,
  printPlannedDeletions,
  runCustomerDomainAudit,
} from "./lib/customer-domain-audit.mjs";

const PROTECTED_PRODUCTION_ADMIN_EMAIL = "admin@shalean.co.za";

const args = process.argv.slice(2);
const applyRequested = args.includes("--apply");
const confirmed = process.env.CONFIRM_CLEANUP_CUSTOMER_DOMAIN === "yes";

loadEnvFiles();
const client = requireServiceRoleClient(createClient);

function usage() {
  console.log(`Customer domain REVIEW cleanup (stray customers rows only)

Usage:
  npm run ops:cleanup:customer-domain
  CONFIRM_CLEANUP_CUSTOMER_DOMAIN=yes npm run ops:cleanup:customer-domain -- --apply

Flags:
  --apply    Delete safe stray customers rows (requires confirm env)
  --help     Show this message

Deletes only when:
  - profiles.role != customer
  - bookings referencing customers.id = 0

Never modifies: auth.users, profiles, profile roles, bookings, cleaners rows`);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} customerId
 */
async function deleteStrayCustomerRow(client, customerId) {
  const { error } = await client.from("customers").delete().eq("id", customerId);
  if (error) throw error;
}

/**
 * @param {ReturnType<typeof buildStrayCustomerDeletionTargets>} targets
 */
function assertDeletionTargetsSafe(targets) {
  for (const row of targets) {
    if (row.role === "customer") {
      throw new Error(
        `Refusing to delete customers row ${row.customerId}: profile role is customer`,
      );
    }
    if (row.bookingCount > 0) {
      throw new Error(
        `Refusing to delete customers row ${row.customerId}: booking_count=${row.bookingCount}`,
      );
    }
    if (!row.customerId) {
      throw new Error(`Refusing deletion for profile ${row.profileId}: missing customer_id`);
    }
  }
}

async function main() {
  if (args.includes("--help") || args.includes("-h")) {
    usage();
    return;
  }

  if (applyRequested && !confirmed) {
    console.error(
      "Error: --apply requires CONFIRM_CLEANUP_CUSTOMER_DOMAIN=yes\n" +
        "Example:\n" +
        "  CONFIRM_CLEANUP_CUSTOMER_DOMAIN=yes npm run ops:cleanup:customer-domain -- --apply",
    );
    process.exit(1);
  }

  const dryRun = !applyRequested || !confirmed;
  console.log(
    dryRun
      ? "Customer domain cleanup (dry-run — no writes)\n"
      : "Customer domain cleanup (apply mode)\n",
  );
  console.log(
    `Protected: ${PROTECTED_PRODUCTION_ADMIN_EMAIL} — profile/auth never modified; stray customers row may be deleted if safe.`,
  );

  const before = await runCustomerDomainAudit(client);
  printAuditSummary(before.summary, "Before");

  const blocked = buildBlockedStrayCustomerRows(before.findings);
  if (blocked.length > 0) {
    console.error("\nError: blocked stray customers rows (bookings > 0) — cleanup refused:");
    printPlannedDeletions(blocked);
    process.exit(1);
  }

  const targets = buildStrayCustomerDeletionTargets(before.findings);
  assertDeletionTargetsSafe(targets);
  printPlannedDeletions(targets);

  if (targets.length === 0) {
    console.log("\nNo safe stray customers rows to delete.");
  } else if (dryRun) {
    console.log("\n[dry-run] Would delete customers rows listed above.");
    console.log(
      "Set CONFIRM_CLEANUP_CUSTOMER_DOMAIN=yes and pass --apply to delete stray rows.",
    );
  } else {
    console.log("\nDeleting stray customers rows…");
    for (const row of targets) {
      await deleteStrayCustomerRow(client, row.customerId);
      console.log(`  ✓ deleted customers.id=${row.customerId} (${row.email})`);
    }
  }

  if (before.summary.unsafe > 0 || before.summary.orphanCustomerRows > 0) {
    console.warn(
      "\nWarning: UNSAFE or orphan customer rows present — this script does not modify them.",
    );
  }

  if (!dryRun) {
    const after = await runCustomerDomainAudit(client);
    printAuditSummary(after.summary, "After");

    const blockedAfter = buildBlockedStrayCustomerRows(after.findings);
    if (blockedAfter.length > 0) {
      console.error("\nError: REVIEW/UNSAFE stray rows remain blocked by bookings:");
      printPlannedDeletions(blockedAfter);
      process.exit(1);
    }

    if (after.summary.repair > 0 || after.summary.unsafe > 0 || after.summary.orphanCustomerRows > 0) {
      console.error("\nError: audit not clean after cleanup.");
      process.exit(1);
    }

    if (after.summary.review > 0) {
      console.error(`\nError: ${after.summary.review} REVIEW finding(s) remain after cleanup.`);
      process.exit(1);
    }
  } else if (targets.length > 0) {
    console.log("\nAfter apply, re-run: npm run ops:audit:customer-domain");
    console.log("Expected: KEEP≈218, REPAIR=0, REVIEW=0, UNSAFE=0");
  }

  console.log("\nReference:");
  console.log("  docs/operations/customer-domain-reconciliation-hardening-plan.md");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
