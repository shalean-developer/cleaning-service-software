#!/usr/bin/env node
/**
 * Unified dry-run audit for mock/test/demo data (no writes).
 *
 * Categories:
 *   KEEP   = real production data
 *   REVIEW = uncertain — do not delete automatically
 *   DELETE = safe mock/test/demo data
 *
 * Usage: npm run ops:audit:mock-data
 */
import { createClient } from "@supabase/supabase-js";
import { assertDeleteBucketSafe, runMockDataAudit } from "./lib/mock-data-loader.mjs";
import { loadEnvFiles, requireServiceRoleClient } from "../e2e/lib/env.mjs";

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

async function main() {
  console.log("Mock data audit (dry-run — no writes)\n");
  console.log("KEEP   = real production data");
  console.log("REVIEW = uncertain, do not delete automatically");
  console.log("DELETE = safe mock/test/demo data\n");

  console.log("Scanning profiles, customers, cleaners, bookings, and related rows…");
  const audit = await runMockDataAudit(client);

  printSection("DELETE impact summary (would remove if confirmed)");
  console.log(`  Mock profiles to delete:     ${audit.impacts.mockProfilesToDelete}`);
  console.log(`  Orphan mock profiles:        ${audit.impacts.orphanProfilesToDelete}`);
  console.log(`  Mock customers to delete:    ${audit.impacts.mockCustomersToDelete}`);
  console.log(`  Mock bookings to delete:     ${audit.impacts.mockBookingsToDelete}`);
  console.log(`  Mock cleaners to delete:     ${audit.impacts.mockCleanersToDelete}`);
  console.log(`  Payments affected:           ${audit.impacts.paymentsAffected}`);
  console.log(`  Payments deletable:          ${audit.impacts.paymentsDeletable}`);
  console.log(`  Earnings affected:           ${audit.impacts.earningsAffected}`);
  console.log(`  Earnings blocked (payout):   ${audit.impacts.earningsBlocked}`);
  console.log(`  Dispatch offers affected:    ${audit.impacts.dispatchOffersAffected}`);
  console.log(`  Payout items blocked:        ${audit.impacts.payoutItemsAffected}`);
  console.log(`  Customer operational audits: ${audit.impacts.customerOperationalAuditsAffected}`);
  console.log(`  Notifications affected:      ${audit.impacts.notificationsAffected}`);

  printSection("Safety summary");
  console.log(`  Protected KEEP count:        ${audit.impacts.protectedKeepCount}`);
  console.log(`  REVIEW count:                ${audit.impacts.reviewCount}`);
  console.log(`  Paid production blocked:     ${audit.impacts.paidProductionBlockedCount}`);

  printSection("Scanned rows");
  console.log(
    `  profiles=${audit.scanned.profiles}  customers=${audit.scanned.customers}  cleaners=${audit.scanned.cleaners}  bookings=${audit.scanned.bookings}`,
  );

  if (audit.profiles.delete.length > 0) {
    printSection("DELETE profiles (sample — up to 25)");
    for (const row of audit.profiles.delete.slice(0, 25)) {
      console.log(`  ${row.email}  ${row.profileId}  role=${row.role}  ${row.fullName ?? "—"}  match=${row.match}`);
    }
    if (audit.profiles.delete.length > 25) {
      console.log(`  … and ${audit.profiles.delete.length - 25} more`);
    }
  }

  if (audit.customers.delete.length > 0) {
    printSection("DELETE customers");
    const headers = ["email", "customer_id", "bookings", "payments", "match"];
    const widths = [40, 38, 8, 8, 24];
    console.log(headers.map((h, i) => pad(h, widths[i])).join(" | "));
    for (const row of audit.customers.delete) {
      console.log(
        [
          pad(row.email, widths[0]),
          pad(row.customerId, widths[1]),
          pad(row.bookingCount, widths[2]),
          pad(row.paymentCount, widths[3]),
          pad(row.match, widths[4]),
        ].join(" | "),
      );
    }
  }

  if (audit.bookings.delete.length > 0) {
    printSection("DELETE bookings (sample — up to 25)");
    for (const row of audit.bookings.delete.slice(0, 25)) {
      console.log(
        `  ${row.bookingId}  status=${row.status}  customer=${row.customerId ?? "—"}  service_uid=${row.serviceUid ?? "—"}  match=${row.match}`,
      );
    }
    if (audit.bookings.delete.length > 25) {
      console.log(`  … and ${audit.bookings.delete.length - 25} more`);
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
        `  ${row.bookingId}  paid=${row.hasPaidPayment}  status=${row.status}  match=${row.match}`,
      );
    }
    if (audit.bookings.review.length > 15) {
      console.log(`  … and ${audit.bookings.review.length - 15} more`);
    }
  }

  if (audit.cleaners.delete.length > 0) {
    printSection("DELETE cleaners");
    for (const row of audit.cleaners.delete) {
      console.log(`  ${row.email}  ${row.cleanerId}  ${row.relatedSummary}`);
    }
  }

  if (audit.cleaners.review.length > 0) {
    printSection("REVIEW cleaners (blocked from auto-delete)");
    for (const row of audit.cleaners.review) {
      console.log(
        `  ${row.email}  paid_real_customer_bookings=${row.bookingSummary.paidRealCustomer}  ${row.relatedSummary}`,
      );
    }
  }

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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
