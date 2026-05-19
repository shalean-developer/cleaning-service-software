#!/usr/bin/env node
/**
 * Removes mock/test cleaners and their cleaner-scoped data only.
 * Real cleaners and paid real-customer bookings are never deleted.
 *
 * Usage:
 *   npm run ops:audit:mock-cleaners
 *   CONFIRM_MOCK_CLEANER_DELETE=yes npm run ops:delete:mock-cleaners
 */
import { createClient } from "@supabase/supabase-js";
import { loadCleanerCandidates } from "./lib/mock-cleaner-data.mjs";
import { loadEnvFiles, requireServiceRoleClient } from "../e2e/lib/env.mjs";

if (process.env.CONFIRM_MOCK_CLEANER_DELETE !== "yes") {
  console.error(
    "Refusing to delete without CONFIRM_MOCK_CLEANER_DELETE=yes\n" +
      "Run audit first: npm run ops:audit:mock-cleaners\n" +
      "Then: CONFIRM_MOCK_CLEANER_DELETE=yes npm run ops:delete:mock-cleaners",
  );
  process.exit(1);
}

loadEnvFiles();
const client = requireServiceRoleClient(createClient);

/**
 * Unassigns mock cleaner from bookings without deleting bookings, payments, or audit rows.
 * @param {string} cleanerId
 */
async function unassignMockCleanerFromBookings(cleanerId) {
  const { data: assignedBookings, error: assignedErr } = await client
    .from("bookings")
    .select("id")
    .eq("cleaner_id", cleanerId);
  if (assignedErr) throw assignedErr;

  const assignedIds = (assignedBookings ?? []).map((b) => b.id);
  if (assignedIds.length > 0) {
    const { error: unassignErr } = await client
      .from("bookings")
      .update({ cleaner_id: null })
      .in("id", assignedIds);
    if (unassignErr) throw unassignErr;
  }

  return assignedIds.length;
}

/**
 * @param {string} cleanerId
 */
async function purgeMockCleaner(cleanerId, profileId) {
  const unassignedBookings = await unassignMockCleanerFromBookings(cleanerId);

  await client.from("cleaner_time_off").delete().eq("cleaner_id", cleanerId);
  await client.from("cleaner_availability").delete().eq("cleaner_id", cleanerId);
  await client.from("cleaner_service_capabilities").delete().eq("cleaner_id", cleanerId);
  await client.from("cleaner_service_areas").delete().eq("cleaner_id", cleanerId);
  await client.from("assignment_offers").delete().eq("cleaner_id", cleanerId);
  await client.from("earning_lines").delete().eq("cleaner_id", cleanerId);
  await client.from("booking_cleaners").delete().eq("cleaner_id", cleanerId);
  await client.from("bookings").update({ cleaner_id: null }).eq("cleaner_id", cleanerId);

  const { count: auditCount, error: auditCountErr } = await client
    .from("cleaner_operational_audit")
    .select("id", { count: "exact", head: true })
    .eq("cleaner_id", cleanerId);
  if (auditCountErr) throw auditCountErr;

  let removedCleanerRow = false;
  if ((auditCount ?? 0) === 0) {
    const { error: cleanerDelErr } = await client.from("cleaners").delete().eq("id", cleanerId);
    if (cleanerDelErr) throw cleanerDelErr;
    removedCleanerRow = true;
  } else {
    const { error: archiveErr } = await client
      .from("cleaners")
      .update({
        active: false,
        deleted_at: new Date().toISOString(),
        lifecycle_reason: "ops_mock_cleaner_purge",
      })
      .eq("id", cleanerId);
    if (archiveErr) throw archiveErr;
  }

  await invalidateAuthUser(profileId);

  return { unassignedBookings, removedCleanerRow };
}

async function invalidateAuthUser(profileId) {
  const randomPassword = `Purged-${crypto.randomUUID()}-!`;
  const { error } = await client.auth.admin.updateUserById(profileId, {
    email: `purged+${profileId}@invalid.local`,
    password: randomPassword,
    email_confirm: true,
  });
  if (error) {
    console.warn(`auth invalidate ${profileId}:`, error.message);
  }
}

async function main() {
  console.log("Deleting mock/test cleaners only…\n");

  const candidates = await loadCleanerCandidates(client);
  const mockRows = candidates.filter(
    (r) =>
      r.classification.mock &&
      !(r.deletedAt != null && r.lifecycleReason === "ops_mock_cleaner_purge"),
  );

  if (mockRows.length === 0) {
    console.log("No mock cleaners matched safe patterns. Nothing deleted.");
    return;
  }

  let totalUnassigned = 0;
  let hardDeleted = 0;
  let archived = 0;

  for (const row of mockRows) {
    const result = await purgeMockCleaner(row.cleanerId, row.profileId);
    totalUnassigned += result.unassignedBookings;
    if (result.removedCleanerRow) hardDeleted += 1;
    else archived += 1;
    console.log(`✓ purged ${row.email} (cleaner ${row.cleanerId})`);
    if (result.unassignedBookings > 0) {
      console.log(`    unassigned ${result.unassignedBookings} booking(s) (rows preserved)`);
    }
    console.log(
      result.removedCleanerRow
        ? "    cleaner row deleted (no operational audit history)"
        : "    cleaner row archived (operational audit history retained)",
    );
  }

  console.log(`\nPurged ${mockRows.length} mock cleaner(s).`);
  console.log(`  Hard-deleted cleaner rows: ${hardDeleted}`);
  console.log(`  Archived cleaner rows:     ${archived}`);
  console.log(`  Bookings unassigned:       ${totalUnassigned}`);
  console.log("\nRe-run audit: npm run ops:audit:mock-cleaners");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
