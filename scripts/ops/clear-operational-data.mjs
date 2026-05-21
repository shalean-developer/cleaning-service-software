#!/usr/bin/env node
/**
 * Full clear of operational booking/customer/cleaner data (production-safe scope).
 * Does not delete append-only audit/event tables.
 *
 * Requires CONFIRM_CLEAR_OPERATIONAL_DATA=yes and a prior audit review.
 *
 * Usage:
 *   npm run ops:audit:clear-operational-data
 *   CONFIRM_CLEAR_OPERATIONAL_DATA=yes npm run ops:clear-operational-data
 */
import { createClient } from "@supabase/supabase-js";
import {
  CONFIRM_ENV_VAR,
  assertNoAdminProfileDeletion,
  bookingDeleteBlockedByAudit,
  collectOperationalCounts,
  executeOperationalClear,
  formatCountsReport,
  operationalDataFullyCleared,
} from "./lib/operational-clear-scope.mjs";
import { loadEnvFiles, requireServiceRoleClient } from "../e2e/lib/env.mjs";

if (process.env[CONFIRM_ENV_VAR] !== "yes") {
  console.error(
    `Refusing to clear without ${CONFIRM_ENV_VAR}=yes\n` +
      "Run audit first: npm run ops:audit:clear-operational-data\n" +
      'Then (PowerShell): $env:CONFIRM_CLEAR_OPERATIONAL_DATA = "yes"; npm run ops:clear-operational-data\n' +
      "Then (bash): CONFIRM_CLEAR_OPERATIONAL_DATA=yes npm run ops:clear-operational-data",
  );
  process.exit(1);
}

loadEnvFiles();
const client = requireServiceRoleClient(createClient);

async function main() {
  console.log("Operational data clear — CONFIRMED\n");
  console.log(
    "Preserves append-only audit/event tables (booking_state_audit, payment_events, etc.).\n",
  );

  await assertNoAdminProfileDeletion(client);

  console.log("--- Before counts ---\n");
  const before = await collectOperationalCounts(client);
  console.log(formatCountsReport(before));

  const adminBefore = before.profiles_admin ?? 0;
  if (bookingDeleteBlockedByAudit(before)) {
    console.log(
      "\n  Preflight: booking_state_audit has rows — booking DELETE may be rejected by DB triggers.\n" +
        "  Audit history will be preserved.\n",
    );
  }

  console.log("\nClearing mutable operational data (per-step commits, not one DB transaction)…\n");
  const deleted = await executeOperationalClear(client);

  console.log("--- Rows removed ---\n");
  for (const [key, count] of Object.entries(deleted)) {
    console.log(`  ${key.padEnd(36)} ${count}`);
  }

  console.log("\n--- After counts ---\n");
  const after = await collectOperationalCounts(client);
  console.log(formatCountsReport(after));

  const adminAfter = after.profiles_admin ?? 0;
  if (adminAfter !== adminBefore) {
    console.error(
      `\nSafety failure: admin profile count changed ${adminBefore} → ${adminAfter}. Investigate immediately.`,
    );
    process.exit(2);
  }

  const auditAfter = after.booking_state_audit ?? 0;
  const auditBefore = before.booking_state_audit ?? 0;
  if (auditAfter !== auditBefore) {
    console.error(
      `\nSafety failure: booking_state_audit count changed ${auditBefore} → ${auditAfter}. Audit must be preserved.`,
    );
    process.exit(2);
  }

  const paymentEventsAfter = after.payment_events ?? 0;
  const paymentEventsBefore = before.payment_events ?? 0;
  if (paymentEventsAfter < paymentEventsBefore) {
    console.error(
      `\nSafety failure: payment_events count dropped ${paymentEventsBefore} → ${paymentEventsAfter}. Event log must be preserved.`,
    );
    process.exit(2);
  }

  if (!operationalDataFullyCleared(after)) {
    if (bookingDeleteBlockedByAudit(after)) {
      console.warn(
        "\nPartial clear: bookings/customers may remain because append-only booking_state_audit is preserved.",
      );
      console.warn("Re-run audit: npm run ops:audit:clear-operational-data");
      if (
        (after.customers ?? 0) === 0 &&
        (after.cleaners ?? 0) === 0 &&
        (after.profiles_customer_cleaner ?? 0) === 0
      ) {
        console.log("\nCore identity tables cleared; booking rows may remain with audit history.");
        return;
      }
    }
    console.error(
      "\nClear incomplete — some operational tables still have rows. Re-run ops:audit:clear-operational-data.",
    );
    process.exit(2);
  }

  console.log("\nOperational clear complete.");
  console.log(`  Admin profiles preserved: ${adminAfter}`);
  console.log(`  booking_state_audit preserved: ${auditAfter}`);
  console.log(`  payment_events preserved: ${paymentEventsAfter}`);
  console.log(`  Services catalog preserved: ${after.services ?? 0}`);
  console.log("\nRe-run audit: npm run ops:audit:clear-operational-data");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
