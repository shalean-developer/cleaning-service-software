#!/usr/bin/env node
/**
 * Removes mock/test/demo data identified by ops:audit:mock-data.
 * Deletes in dependency order: booking deps → bookings → customers → cleaners → orphan profiles.
 *
 * Usage:
 *   npm run ops:audit:mock-data
 *   CONFIRM_MOCK_DATA_DELETE=yes npm run ops:delete:mock-data
 */
import { createClient } from "@supabase/supabase-js";
import { assertDeleteBucketSafe, runMockDataAudit } from "./lib/mock-data-loader.mjs";
import { purgeMockDataFromAudit } from "./lib/mock-data-purge.mjs";
import { loadEnvFiles, requireServiceRoleClient } from "../e2e/lib/env.mjs";

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

async function main() {
  console.log("Mock data delete — preflight audit\n");

  const audit = await runMockDataAudit(client);

  console.log("Planned deletion scope:");
  console.log(`  Mock profiles to delete:     ${audit.impacts.mockProfilesToDelete}`);
  console.log(`  Mock customers to delete:    ${audit.impacts.mockCustomersToDelete}`);
  console.log(`  Mock bookings to delete:     ${audit.impacts.mockBookingsToDelete}`);
  console.log(`  Mock cleaners to delete:     ${audit.impacts.mockCleanersToDelete}`);
  console.log(`  Payments deletable:          ${audit.impacts.paymentsDeletable}`);
  console.log(`  REVIEW (skipped):            ${audit.impacts.reviewCount}`);
  console.log(`  Paid production blocked:     ${audit.impacts.paidProductionBlockedCount}\n`);

  assertDeleteBucketSafe(audit);

  const hasWork =
    audit.impacts.mockProfilesToDelete > 0 ||
    audit.impacts.mockCustomersToDelete > 0 ||
    audit.impacts.mockBookingsToDelete > 0 ||
    audit.impacts.mockCleanersToDelete > 0;

  if (!hasWork) {
    console.log("Nothing in DELETE bucket. Exiting without changes.");
    return;
  }

  console.log("Purging mock data in dependency order…\n");
  const summary = await purgeMockDataFromAudit(client, audit);

  console.log("\n--- Purge summary ---");
  console.log(`  Bookings deleted:            ${summary.bookingsDeleted}`);
  console.log(`  Payments deleted:            ${summary.paymentsDeleted}`);
  console.log(`  Customers deleted:           ${summary.customersDeleted}`);
  console.log(`  Customers anonymized:        ${summary.customersAnonymized}`);
  console.log(`  Cleaners purged:             ${summary.cleanersPurged}`);
  console.log(`  Profiles deleted:            ${summary.profilesDeleted}`);
  console.log(`  Auth users deleted:          ${summary.authUsersDeleted}`);
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
