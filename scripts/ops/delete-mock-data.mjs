#!/usr/bin/env node
/**
 * Removes mock/test/demo data identified by ops:audit:mock-data.
 * Deletes in dependency order: bookings → customers → cleaners → orphan profiles.
 *
 * Usage:
 *   npm run ops:audit:mock-data
 *   CONFIRM_MOCK_DATA_DELETE=yes npm run ops:delete:mock-data
 *   CONFIRM_MOCK_DATA_DELETE=yes npm run ops:delete:mock-data -- --allow-review
 */
import { createClient } from "@supabase/supabase-js";
import { assertDeleteBucketSafe, runMockDataAudit } from "./lib/mock-data-loader.mjs";
import { purgeMockDataFromAudit } from "./lib/mock-data-purge.mjs";
import { loadEnvFiles, requireServiceRoleClient } from "../e2e/lib/env.mjs";

const allowReview = process.argv.includes("--allow-review");

if (process.env.CONFIRM_MOCK_DATA_DELETE !== "yes") {
  console.error(
    "Refusing to delete without CONFIRM_MOCK_DATA_DELETE=yes\n" +
      "Run audit first: npm run ops:audit:mock-data\n" +
      'Then (PowerShell): $env:CONFIRM_MOCK_DATA_DELETE = "yes"; npm run ops:delete:mock-data\n' +
      "Then (bash): CONFIRM_MOCK_DATA_DELETE=yes npm run ops:delete:mock-data",
  );
  process.exit(1);
}

loadEnvFiles();
const client = requireServiceRoleClient(createClient);

function printRowsToAffect(audit) {
  console.log("\n--- Rows that will be affected ---\n");

  if (audit.bookings.hardDelete?.length) {
    console.log(`Bookings (hard_delete): ${audit.bookings.hardDelete.length}`);
    for (const row of audit.bookings.hardDelete) {
      console.log(`  ${row.bookingId}  status=${row.status}  match=${row.match}`);
    }
  }

  if (audit.bookings.archive?.length) {
    console.log(`\nBookings (archive): ${audit.bookings.archive.length}`);
    for (const row of audit.bookings.archive) {
      console.log(`  ${row.bookingId}  status=${row.status}  match=${row.match}`);
    }
  }

  if (audit.customers.delete.length) {
    console.log(`\nCustomers (delete/anonymize): ${audit.customers.delete.length}`);
    for (const row of audit.customers.delete) {
      console.log(`  ${row.customerId}  ${row.email}  bookings=${row.bookingCount}`);
    }
  }

  if (audit.cleaners.delete.length) {
    console.log(`\nCleaners (purge): ${audit.cleaners.delete.length}`);
    for (const row of audit.cleaners.delete) {
      console.log(`  ${row.cleanerId}  ${row.email}`);
    }
  }

  if (audit.profiles.orphanDelete.length) {
    console.log(`\nOrphan profiles: ${audit.profiles.orphanDelete.length}`);
    for (const row of audit.profiles.orphanDelete) {
      console.log(`  ${row.profileId}  ${row.email}`);
    }
  }

  if (audit.impacts.reviewCount > 0) {
    console.log(`\nSkipped REVIEW rows: ${audit.impacts.reviewCount}`);
  }
}

async function main() {
  console.log("Mock data delete — preflight audit\n");

  const audit = await runMockDataAudit(client);

  console.log("Planned deletion scope:");
  console.log(`  Bookings hard_delete:        ${audit.impacts.mockBookingsHardDelete}`);
  console.log(`  Bookings archive:            ${audit.impacts.mockBookingsArchive}`);
  console.log(`  Mock customers to delete:    ${audit.impacts.mockCustomersToDelete}`);
  console.log(`  Mock cleaners to delete:     ${audit.impacts.mockCleanersToDelete}`);
  console.log(`  Orphan profiles:             ${audit.impacts.orphanProfilesToDelete}`);
  console.log(`  REVIEW (skipped):            ${audit.impacts.reviewCount}`);

  printRowsToAffect(audit);

  if (audit.impacts.reviewCount > 0 && !allowReview) {
    console.error(
      `\nRefusing delete: ${audit.impacts.reviewCount} REVIEW row(s). Resolve manually or pass --allow-review.`,
    );
    process.exit(1);
  }

  assertDeleteBucketSafe(audit);

  const hasWork =
    audit.impacts.mockProfilesToDelete > 0 ||
    audit.impacts.mockCustomersToDelete > 0 ||
    audit.impacts.mockBookingsToDelete > 0 ||
    audit.impacts.mockCleanersToDelete > 0;

  if (!hasWork) {
    console.log("\nNothing in DELETE bucket. Exiting without changes.");
    return;
  }

  console.log("\nPurging mock data in dependency order…\n");
  const summary = await purgeMockDataFromAudit(client, audit);

  console.log("\n--- Purge summary ---");
  console.log(`  Bookings hard-deleted:       ${summary.bookingsHardDeleted}`);
  console.log(`  Bookings archived:           ${summary.bookingsArchived}`);
  console.log(`  Customers deleted:           ${summary.customersDeleted}`);
  console.log(`  Customers anonymized:        ${summary.customersAnonymized}`);
  console.log(`  Cleaners purged:             ${summary.cleanersPurged}`);
  console.log(`  Profiles deleted:            ${summary.profilesDeleted}`);
  console.log(`  Auth users deleted:          ${summary.authUsersDeleted}`);
  console.log(`  Offers cancelled:            ${summary.offersCancelled}`);
  console.log(`  Operational audits deleted:  ${summary.operationalAuditsDeleted}`);
  console.log(`  Notifications deleted:       ${summary.notificationsDeleted}`);

  if (summary.warnings.length > 0) {
    console.log("\nWarnings:");
    for (const w of summary.warnings) console.log(`  - ${w}`);
  }

  console.log("\nRe-run audit: npm run ops:audit:mock-data");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
