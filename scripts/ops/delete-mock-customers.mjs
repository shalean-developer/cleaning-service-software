#!/usr/bin/env node
/**
 * Removes mock/test customers and mock-scoped operational data only.
 * Real customers and ambiguous paid production bookings are never deleted.
 *
 * Usage:
 *   npm run ops:audit:mock-customers
 *   CONFIRM_MOCK_CUSTOMER_DELETE=yes npm run ops:delete:mock-customers
 */
import { createClient } from "@supabase/supabase-js";
import {
  assertCustomerSafeToPurge,
  countCustomerRelatedRows,
  countCustomerRelatedRowsForAudit,
  enrichCustomerAuditRow,
  loadCustomerCandidates,
  selectBookingsToDelete,
} from "./lib/mock-customer-data.mjs";
import { loadEnvFiles, requireServiceRoleClient } from "../e2e/lib/env.mjs";

if (process.env.CONFIRM_MOCK_CUSTOMER_DELETE !== "yes") {
  console.error(
    "Refusing to delete without CONFIRM_MOCK_CUSTOMER_DELETE=yes\n" +
      "Run audit first: npm run ops:audit:mock-customers\n" +
      'Then (PowerShell): $env:CONFIRM_MOCK_CUSTOMER_DELETE = "yes"; npm run ops:delete:mock-customers\n' +
      "Then (bash): CONFIRM_MOCK_CUSTOMER_DELETE=yes npm run ops:delete:mock-customers",
  );
  process.exit(1);
}

loadEnvFiles();
const client = requireServiceRoleClient(createClient);

const summary = {
  customersDeleted: 0,
  customersAnonymized: 0,
  bookingsDeleted: 0,
  bookingsSkipped: 0,
  paymentsDeleted: 0,
  recurringSeriesCleared: 0,
  notificationsDeleted: 0,
  bookingLocksDeleted: 0,
  skippedCustomers: 0,
  warnings: [],
};

/**
 * @param {string[]} bookingIds
 */
async function deleteMockBookings(bookingIds) {
  if (bookingIds.length === 0) return;

  const chunkSize = 50;
  for (let i = 0; i < bookingIds.length; i += chunkSize) {
    const chunk = bookingIds.slice(i, i + chunkSize);

    await client.from("earning_lines").delete().in("booking_id", chunk);

    const { data: paymentRows, error: payListErr } = await client
      .from("payments")
      .select("id")
      .in("booking_id", chunk);
    if (payListErr) throw payListErr;

    const paymentIds = (paymentRows ?? []).map((p) => p.id);
    if (paymentIds.length > 0) {
      await client.from("payment_events").delete().in("payment_id", paymentIds);
      const { error: payDelErr } = await client.from("payments").delete().in("id", paymentIds);
      if (payDelErr) throw payDelErr;
      summary.paymentsDeleted += paymentIds.length;
    }

    await client.from("booking_locks").delete().in("booking_id", chunk);
    const { error: bookingDelErr } = await client.from("bookings").delete().in("id", chunk);
    if (bookingDelErr) throw bookingDelErr;
    summary.bookingsDeleted += chunk.length;
  }
}

/**
 * @param {string} customerId
 */
async function deleteRemainingBookingLocks(customerId) {
  const { count, error } = await client
    .from("booking_locks")
    .delete({ count: "exact" })
    .eq("customer_id", customerId);
  if (error) throw error;
  summary.bookingLocksDeleted += count ?? 0;
}

/**
 * @param {string} email
 */
async function deleteNotificationsForEmail(email) {
  if (!email || email.includes("(no auth")) return;
  const { count, error } = await client
    .from("notification_outbox")
    .delete({ count: "exact" })
    .eq("recipient", email);
  if (error) throw error;
  summary.notificationsDeleted += count ?? 0;
}

/**
 * @param {string} profileId
 */
async function invalidateAuthUser(profileId, customerId) {
  const randomPassword = `Purged-${crypto.randomUUID()}-!`;
  const { error } = await client.auth.admin.updateUserById(profileId, {
    email: `purged+${customerId}@invalid.local`,
    password: randomPassword,
    email_confirm: true,
  });
  if (error) {
    summary.warnings.push(`auth invalidate ${profileId}: ${error.message}`);
  }
}

/**
 * @param {Awaited<ReturnType<typeof enrichCustomerAuditRow>>} row
 * @param {Awaited<ReturnType<typeof countCustomerRelatedRows>>} related
 */
async function purgeMockCustomer(row, related) {
  assertCustomerSafeToPurge(row);

  const bookingIdsToDelete = selectBookingsToDelete(
    related.bookingIds,
    related.bookingRows,
    row.classification,
  );
  summary.bookingsSkipped += related.bookingIds.length - bookingIdsToDelete.length;

  const recurringBefore = related.recurringCount;
  if (bookingIdsToDelete.length > 0) {
    console.log(`    removing ${bookingIdsToDelete.length} booking(s)…`);
  }
  await deleteMockBookings(bookingIdsToDelete);
  if (recurringBefore > 0 && bookingIdsToDelete.length > 0) {
    summary.recurringSeriesCleared += recurringBefore;
  }

  await deleteRemainingBookingLocks(row.customerId);
  await deleteNotificationsForEmail(row.email);

  const { count: remainingBookings, error: remainErr } = await client
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", row.customerId);
  if (remainErr) throw remainErr;

  if ((remainingBookings ?? 0) > 0) {
    const { error: anonErr } = await client
      .from("customers")
      .update({
        company_name: `purged_mock_${row.customerId.slice(0, 8)}`,
        phone: null,
        notes: "[ops_mock_customer_purge] anonymized — bookings preserved",
      })
      .eq("id", row.customerId);
    if (anonErr) throw anonErr;
    await invalidateAuthUser(row.userId, row.customerId);
    summary.customersAnonymized += 1;
    summary.warnings.push(
      `${row.email}: ${remainingBookings} booking(s) preserved (paid/production safety)`,
    );
    console.log(
      `✓ anonymized ${row.email} — preserved ${remainingBookings} booking row(s)`,
    );
    return;
  }

  if (related.customerOperationalAudit > 0) {
    const label = `purged_mock_${row.customerId.slice(0, 8)}`;
    const { error: anonErr } = await client
      .from("customers")
      .update({
        company_name: label,
        phone: null,
        notes: "[ops_mock_customer_purge] anonymized — audit retained",
      })
      .eq("id", row.customerId);
    if (anonErr) throw anonErr;
    await invalidateAuthUser(row.userId, row.customerId);
    summary.customersAnonymized += 1;
    console.log(
      `✓ anonymized ${row.email} (customer ${row.customerId}) — ${related.customerOperationalAudit} audit row(s) retained`,
    );
    return;
  }

  const { error: customerDelErr } = await client.from("customers").delete().eq("id", row.customerId);
  if (customerDelErr) throw customerDelErr;

  const { error: profileDelErr } = await client.from("profiles").delete().eq("id", row.userId);
  if (profileDelErr) throw profileDelErr;

  const { error: authDelErr } = await client.auth.admin.deleteUser(row.userId);
  if (authDelErr) {
    summary.warnings.push(`auth delete ${row.userId}: ${authDelErr.message}`);
    await invalidateAuthUser(row.userId, row.customerId);
  }

  summary.customersDeleted += 1;
  console.log(`✓ purged ${row.email} (customer ${row.customerId})`);
}

async function main() {
  console.log("Deleting mock/test customers only…\n");
  console.log("Step 1/2: Loading profiles and scanning mock candidates (dry-run checks)…");

  const candidates = await loadCustomerCandidates(client);
  const mockCandidates = candidates.filter(
    (row) => row.customerId && row.classification.mock && !row.alreadyPurged,
  );
  console.log(`  ${mockCandidates.length} mock candidate(s) to evaluate\n`);

  const targets = [];
  let scanIndex = 0;
  for (const row of mockCandidates) {
    scanIndex += 1;
    console.log(`  [scan ${scanIndex}/${mockCandidates.length}] ${row.email}`);
    const related = await countCustomerRelatedRowsForAudit(client, row.customerId, {
      classification: row.classification,
    });
    const enriched = enrichCustomerAuditRow(row, related, 0);
    if (enriched.decision === "DELETE") {
      targets.push({ row: enriched });
    } else if (enriched.decision === "REVIEW") {
      summary.skippedCustomers += 1;
      summary.warnings.push(`skipped REVIEW: ${enriched.email}`);
      console.log(`    → skipped (REVIEW — paid/production safety)`);
    }
  }

  if (targets.length === 0) {
    console.log("No mock customers matched safe DELETE criteria. Nothing changed.");
    if (summary.warnings.length > 0) {
      console.log("\nWarnings:");
      for (const w of summary.warnings) console.log(`  - ${w}`);
    }
    return;
  }

  console.log(`\nStep 2/2: Purging ${targets.length} customer(s)…\n`);

  let purgeIndex = 0;
  for (const { row } of targets) {
    purgeIndex += 1;
    try {
      console.log(`[purge ${purgeIndex}/${targets.length}] ${row.email}`);
      const related = await countCustomerRelatedRows(client, row.customerId, {
        needsBookingRows: true,
      });
      const deletable = selectBookingsToDelete(
        related.bookingIds,
        related.bookingRows,
        row.classification,
      );
      await purgeMockCustomer(row, related);
      const preserved = related.bookingIds.length - deletable.length;
      if (preserved > 0) {
        console.log(`    preserved ${preserved} non-mock booking(s)`);
      }
    } catch (err) {
      summary.skippedCustomers += 1;
      const message = err instanceof Error ? err.message : String(err);
      summary.warnings.push(`failed ${row.email}: ${message}`);
      console.error(`✗ skipped ${row.email}: ${message}`);
    }
  }

  console.log("\n--- Purge summary ---");
  console.log(`  Customers hard-deleted:     ${summary.customersDeleted}`);
  console.log(`  Customers anonymized:       ${summary.customersAnonymized}`);
  console.log(`  Bookings deleted:           ${summary.bookingsDeleted}`);
  console.log(`  Bookings preserved:         ${summary.bookingsSkipped}`);
  console.log(`  Payments deleted:           ${summary.paymentsDeleted}`);
  console.log(`  Recurring rows cleared:     ${summary.recurringSeriesCleared}`);
  console.log(`  Notifications deleted:      ${summary.notificationsDeleted}`);
  console.log(`  Booking locks deleted:      ${summary.bookingLocksDeleted}`);
  console.log(`  Customers skipped:          ${summary.skippedCustomers}`);

  if (summary.warnings.length > 0) {
    console.log("\nSafety warnings:");
    for (const w of summary.warnings) console.log(`  - ${w}`);
  }

  console.log("\nPayout batches and global notification metrics were not modified.");
  console.log("Re-run audit: npm run ops:audit:mock-customers");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
