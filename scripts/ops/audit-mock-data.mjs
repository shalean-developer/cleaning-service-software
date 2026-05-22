#!/usr/bin/env node
/**
 * Unified dry-run audit for mock/test/demo data (no writes).
 *
 * Categories:
 *   KEEP   = real production data
 *   REVIEW = uncertain — do not delete automatically
 *   DELETE = safe mock/test/demo data (hard_delete or archive purge action)
 *
 * Usage:
 *   npm run ops:audit:mock-data
 *   npm run ops:audit:mock-data -- --allow-review
 */
import { createClient } from "@supabase/supabase-js";
import { assertDeleteBucketSafe, runMockDataAudit } from "./lib/mock-data-loader.mjs";
import { JSON_NAME, CSV_NAME, writeMockDataAuditReports } from "./lib/mock-data-audit-report.mjs";
import { loadEnvFiles, requireServiceRoleClient } from "../e2e/lib/env.mjs";

const allowReview = process.argv.includes("--allow-review");

loadEnvFiles();
const client = requireServiceRoleClient(createClient);

function pad(value, width) {
  const text = String(value ?? "");
  return text.length >= width ? text.slice(0, width) : text.padEnd(width);
}

function printSection(title) {
  console.log(`\n${title}`);
  console.log("-".repeat(title.length));
}

function printClassificationCounts(label, audit) {
  printSection(`${label} — DELETE / KEEP / REVIEW`);
  const entity =
    label === "Bookings"
      ? audit.bookings
      : label === "Customers"
        ? audit.customers
        : audit.cleaners;
  console.log(`  DELETE: ${entity.delete.length}`);
  console.log(`  KEEP:   ${entity.keep.length}`);
  console.log(`  REVIEW: ${entity.review.length}`);
  if (label === "Bookings") {
    console.log(`    hard_delete purge: ${audit.bookings.hardDelete?.length ?? 0}`);
    console.log(`    archive purge:     ${audit.bookings.archive?.length ?? 0}`);
    console.log(`    blocked (→REVIEW): ${audit.bookings.blocked?.length ?? 0}`);
  }
}

async function main() {
  console.log("Mock data audit (dry-run — no writes)\n");
  console.log("KEEP   = real production data");
  console.log("REVIEW = uncertain, do not delete automatically");
  console.log("DELETE = safe mock/test/demo data\n");

  console.log("Scanning profiles, customers, cleaners, bookings, and related rows…");
  const audit = await runMockDataAudit(client);

  printClassificationCounts("Bookings", audit);
  printClassificationCounts("Customers", audit);
  printClassificationCounts("Cleaners", audit);

  printSection("Blocked due to payment / earnings / payout / history");
  const blocked = audit.impacts.blockedByFinancialOrHistory ?? {};
  console.log(`  payment:    ${blocked.payment ?? 0}`);
  console.log(`  earning:    ${blocked.earning ?? 0}`);
  console.log(`  payout:     ${blocked.payout ?? 0}`);
  console.log(`  completed:  ${blocked.completed ?? 0}`);
  console.log(`  assigned:   ${blocked.assigned ?? 0}`);
  console.log(`  recurring:  ${blocked.recurring ?? 0}`);
  console.log(`  support:    ${blocked.support ?? 0}`);
  console.log(`  paid production in REVIEW: ${audit.impacts.paidProductionBlockedCount}`);

  printSection("DELETE impact summary (would remove if confirmed)");
  console.log(`  Mock profiles to delete:     ${audit.impacts.mockProfilesToDelete}`);
  console.log(`  Orphan mock profiles:        ${audit.impacts.orphanProfilesToDelete}`);
  console.log(`  Mock customers to delete:    ${audit.impacts.mockCustomersToDelete}`);
  console.log(`  Mock bookings (total):       ${audit.impacts.mockBookingsToDelete}`);
  console.log(`    hard_delete:               ${audit.impacts.mockBookingsHardDelete}`);
  console.log(`    archive:                   ${audit.impacts.mockBookingsArchive}`);
  console.log(`  Mock cleaners to delete:     ${audit.impacts.mockCleanersToDelete}`);
  console.log(`  Payments affected:           ${audit.impacts.paymentsAffected}`);
  console.log(`  Payments deletable:          ${audit.impacts.paymentsDeletable}`);
  console.log(`  Earnings affected:           ${audit.impacts.earningsAffected}`);
  console.log(`  Earnings blocked (payout):   ${audit.impacts.earningsBlocked}`);
  console.log(`  Dispatch offers affected:    ${audit.impacts.dispatchOffersAffected}`);
  console.log(`  Payout items blocked:        ${audit.impacts.payoutItemsAffected}`);

  printSection("Safety summary");
  console.log(`  Protected KEEP count:        ${audit.impacts.protectedKeepCount}`);
  console.log(`  REVIEW count:                ${audit.impacts.reviewCount}`);
  console.log(`  Paid production blocked:     ${audit.impacts.paidProductionBlockedCount}`);

  printSection("Scanned rows");
  console.log(
    `  profiles=${audit.scanned.profiles}  customers=${audit.scanned.customers}  cleaners=${audit.scanned.cleaners}  bookings=${audit.scanned.bookings}`,
  );

  if (audit.bookings.hardDelete?.length > 0) {
    printSection("DELETE bookings — hard_delete (sample — up to 25)");
    for (const row of audit.bookings.hardDelete.slice(0, 25)) {
      console.log(
        `  ${row.bookingId}  status=${row.status}  customer=${row.customerId ?? "—"}  match=${row.match}`,
      );
    }
    if (audit.bookings.hardDelete.length > 25) {
      console.log(`  … and ${audit.bookings.hardDelete.length - 25} more`);
    }
  }

  if (audit.bookings.archive?.length > 0) {
    printSection("DELETE bookings — archive (sample — up to 15)");
    for (const row of audit.bookings.archive.slice(0, 15)) {
      console.log(
        `  ${row.bookingId}  status=${row.status}  blocked_hard_delete=${row.hardDeleteBlockedReasons?.join("; ") ?? "—"}`,
      );
    }
  }

  if (audit.customers.delete.length > 0) {
    printSection("DELETE customers");
    for (const row of audit.customers.delete) {
      console.log(
        `  ${row.email}  ${row.customerId}  bookings=${row.bookingCount}  payments=${row.paymentCount}  match=${row.match}`,
      );
    }
  }

  if (audit.cleaners.delete.length > 0) {
    printSection("DELETE cleaners");
    for (const row of audit.cleaners.delete) {
      console.log(`  ${row.email}  ${row.cleanerId}  ${row.relatedSummary}`);
    }
  }

  if (audit.customers.review.length > 0) {
    printSection("REVIEW customers (blocked from auto-delete)");
    for (const row of audit.customers.review) {
      console.log(
        `  ${row.email}  paid_production=${row.paidProductionBookings}  bookings=${row.bookingCount}  match=${row.match}`,
      );
    }
  }

  if (audit.bookings.review.length > 0) {
    printSection("REVIEW bookings (sample — up to 15)");
    for (const row of audit.bookings.review.slice(0, 15)) {
      console.log(
        `  ${row.bookingId}  paid=${row.hasPaidPayment}  status=${row.status}  ${(row.blockedReasons ?? row.hardDeleteBlockedReasons ?? []).join("; ")}  match=${row.match}`,
      );
    }
    if (audit.bookings.review.length > 15) {
      console.log(`  … and ${audit.bookings.review.length - 15} more`);
    }
  }

  if (audit.cleaners.review.length > 0) {
    printSection("REVIEW cleaners (blocked from auto-delete)");
    for (const row of audit.cleaners.review) {
      console.log(
        `  ${row.email}  ${(row.blockedReasons ?? []).join("; ")}  ${row.relatedSummary}`,
      );
    }
  }

  const { jsonPath, csvPath } = writeMockDataAuditReports(audit);
  printSection("Audit reports written");
  console.log(`  ${jsonPath}`);
  console.log(`  ${csvPath}`);

  try {
    assertDeleteBucketSafe(audit);
    console.log("\nSafety check: DELETE bucket passed (no paid production on DELETE rows).");
  } catch (err) {
    console.error(`\n${err instanceof Error ? err.message : err}`);
    console.error(
      "\nDo NOT run delete until DELETE bucket is corrected. Inspect REVIEW rows and adjust patterns.",
    );
    process.exit(2);
  }

  const reviewCount = audit.impacts.reviewCount;
  if (reviewCount > 0 && !allowReview) {
    console.error(
      `\n${reviewCount} REVIEW row(s) require manual inspection. Re-run with --allow-review to exit 0 anyway.`,
    );
    process.exit(1);
  }

  if (reviewCount > 0 && allowReview) {
    console.log(`\n--allow-review: exiting 0 despite ${reviewCount} REVIEW row(s).`);
  }

  const hasDeletes =
    audit.impacts.mockProfilesToDelete > 0 ||
    audit.impacts.mockCustomersToDelete > 0 ||
    audit.impacts.mockBookingsToDelete > 0 ||
    audit.impacts.mockCleanersToDelete > 0;

  if (hasDeletes) {
    console.log("\nWhen audit looks correct, delete with:");
    console.log("  PowerShell:");
    console.log('    $env:CONFIRM_MOCK_DATA_DELETE = "yes"; npm run ops:delete:mock-data');
    console.log("  bash:");
    console.log("    CONFIRM_MOCK_DATA_DELETE=yes npm run ops:delete:mock-data");
  } else {
    console.log("\nNo mock entities in DELETE bucket. Nothing to purge.");
  }
}

function printConnectionHelp(err) {
  const text = err instanceof Error ? `${err.message}\n${err.cause ?? ""}` : String(err);
  if (!/ENOTFOUND|fetch failed|ECONNREFUSED|ETIMEDOUT/i.test(text)) return false;

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "(not set)";
  console.error("\nCould not reach Supabase. Check:\n");
  console.error(`  1. SUPABASE_URL in .env.local — currently: ${url}`);
  console.error("  2. Internet / VPN / firewall (DNS must resolve *.supabase.co)");
  console.error("  3. Project is active in the Supabase dashboard (not paused/deleted)");
  console.error("  4. For local dev: npx supabase status → use http://127.0.0.1:54321\n");
  return true;
}

main().catch((err) => {
  if (!printConnectionHelp(err)) console.error(err);
  process.exit(1);
});
