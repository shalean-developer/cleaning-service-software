#!/usr/bin/env node
/**
 * Dry-run audit: exact row counts for a full operational data clear.
 * Does not modify data.
 *
 * Usage: npm run ops:audit:clear-operational-data
 */
import { createClient } from "@supabase/supabase-js";
import {
  CLEAR_STEPS,
  bookingDeleteBlockedByAudit,
  collectOperationalCounts,
  formatCountsReport,
} from "./lib/operational-clear-scope.mjs";
import { loadEnvFiles, requireServiceRoleClient } from "../e2e/lib/env.mjs";

loadEnvFiles();
const client = requireServiceRoleClient(createClient);

async function main() {
  console.log("Operational data clear — audit (dry-run, no writes)\n");
  console.log("Clears: bookings, customers, cleaners, and mutable dependency tables.");
  console.log("Preserves: append-only audit/event logs, admin profiles, services catalog.");
  console.log(
    "Requires migration 20260521120000_ops_preserve_append_only_audit_on_clear.sql before clear can remove bookings.\n",
  );

  console.log("Collecting counts…");
  const counts = await collectOperationalCounts(client);

  console.log("\n--- Scope report ---\n");
  console.log(formatCountsReport(counts));

  const totalBookings = counts.bookings ?? 0;
  const totalCustomers = counts.customers ?? 0;
  const totalCleaners = counts.cleaners ?? 0;
  const totalProfiles = counts.profiles_customer_cleaner ?? 0;
  const auditRows = counts.booking_state_audit ?? 0;

  console.log("\n--- Summary ---");
  console.log(`  Bookings (mutable, to clear):     ${totalBookings}`);
  console.log(`  Bookings with series_id:          ${counts.bookings_with_series ?? 0}`);
  console.log(`  Customers (to clear):             ${totalCustomers}`);
  console.log(`  Cleaners (to clear):              ${totalCleaners}`);
  console.log(`  Customer/cleaner profiles:        ${totalProfiles}`);
  console.log(`  booking_state_audit (preserved):  ${auditRows}`);
  console.log(`  payment_events (preserved):       ${counts.payment_events ?? 0}`);
  console.log(`  Admin profiles (preserved):       ${counts.profiles_admin ?? 0}`);
  console.log(`  Services catalog (preserved):     ${counts.services ?? 0}`);
  console.log(`  Test/mock auth users to delete:   ${counts.auth_users_test_mock ?? 0}`);
  console.log(`  Production auth users kept:       ${counts.auth_users_protected ?? 0}`);

  if (bookingDeleteBlockedByAudit(counts)) {
    console.log(
      "\n  Note: Deleting bookings may fail while booking_state_audit rows exist.\n" +
        "  The workflow does not delete audit rows (append-only). Historical audit stays.\n" +
        "  If booking delete is blocked, customer rows may remain (ON DELETE RESTRICT).",
    );
  }

  console.log("\nDelete steps when confirmed:");
  for (const step of CLEAR_STEPS) {
    const tableList = [...step.tables, ...(step.extraCounts ?? [])].join(", ");
    const note = step.notes?.length ? ` (${step.notes.join("; ")})` : "";
    console.log(`  ${step.step}. ${step.label} — ${tableList}${note}`);
  }

  if (totalBookings === 0 && totalCustomers === 0 && totalCleaners === 0) {
    console.log("\nOperational tables are already empty. No clear needed.");
  } else {
    console.log("\nWhen counts look correct, clear with:");
    console.log("  PowerShell:");
    console.log('    $env:CONFIRM_CLEAR_OPERATIONAL_DATA = "yes"; npm run ops:clear-operational-data');
    console.log("  bash:");
    console.log("    CONFIRM_CLEAR_OPERATIONAL_DATA=yes npm run ops:clear-operational-data");
    console.log("\nDo NOT run clear until you have reviewed these counts.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
