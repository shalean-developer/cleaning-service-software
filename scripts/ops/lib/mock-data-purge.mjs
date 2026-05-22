import { isPaidProductionPaymentStatus } from "./mock-patterns.mjs";
import { PROTECTED_CUSTOMER_EMAILS } from "./mock-customer-patterns.mjs";
import { hasExplicitTestProfileEmail } from "./mock-profile-patterns.mjs";
import {
  recordOpsAdminDeleteAudit,
  resolveOpsAdminProfileId,
} from "./mock-data-admin-audit.mjs";

const CHUNK = 50;
const PURGE_REASON = "ops_mock_data_purge";

/**
 * Cancel open assignment offers for a booking (mock cleanup).
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} bookingId
 */
async function cancelOpenOffersForBooking(client, bookingId) {
  const { data: offers, error } = await client
    .from("assignment_offers")
    .select("id, status")
    .eq("booking_id", bookingId);
  if (error) throw error;
  const openIds = (offers ?? [])
    .filter((o) => !["cancelled", "declined", "expired"].includes(String(o.status)))
    .map((o) => o.id);
  if (openIds.length === 0) return 0;
  const { error: updErr } = await client
    .from("assignment_offers")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .in("id", openIds);
  if (updErr) throw updErr;
  return openIds.length;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} bookingId
 * @param {string} adminProfileId
 */
async function hardDeleteBooking(client, bookingId, adminProfileId) {
  const { error } = await client.rpc("admin_hard_delete_booking", {
    p_booking_id: bookingId,
  });
  if (error) throw error;
  await recordOpsAdminDeleteAudit(client, {
    entityType: "booking",
    entityId: bookingId,
    adminProfileId,
    action: "hard_delete",
    outcome: "success",
    reason: PURGE_REASON,
  });
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} bookingId
 * @param {string} adminProfileId
 */
async function archiveBooking(client, bookingId, adminProfileId) {
  await cancelOpenOffersForBooking(client, bookingId);
  const nowIso = new Date().toISOString();
  const { error } = await client
    .from("bookings")
    .update({
      deleted_at: nowIso,
      deleted_by_profile_id: adminProfileId,
      delete_reason: PURGE_REASON,
      updated_at: nowIso,
    })
    .eq("id", bookingId);
  if (error) throw error;
  await recordOpsAdminDeleteAudit(client, {
    entityType: "booking",
    entityId: bookingId,
    adminProfileId,
    action: "archive",
    outcome: "success",
    reason: PURGE_REASON,
  });
}

/**
 * Legacy path: remove unpaid mock payment deps then booking row (only when RPC unavailable).
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string[]} bookingIds
 */
async function deleteBookingDependenciesLegacy(client, bookingIds) {
  if (bookingIds.length === 0) return { paymentsDeleted: 0, bookingsDeleted: 0 };

  let paymentsDeleted = 0;
  let bookingsDeleted = 0;

  for (let i = 0; i < bookingIds.length; i += CHUNK) {
    const chunk = bookingIds.slice(i, i + CHUNK);

    await client.from("assignment_offers").delete().in("booking_id", chunk);
    await client.from("booking_cleaners").delete().in("booking_id", chunk);
    await client.from("booking_state_audit").delete().in("booking_id", chunk);

    const { data: earnings, error: earnErr } = await client
      .from("earning_lines")
      .select("id, payout_batch_id, payout_status")
      .in("booking_id", chunk);
    if (earnErr) throw earnErr;
    const deletableEarnings = (earnings ?? [])
      .filter((el) => !el.payout_batch_id)
      .map((el) => el.id);
    if (deletableEarnings.length > 0) {
      await client.from("earning_lines").delete().in("id", deletableEarnings);
    }

    const { data: payments, error: payListErr } = await client
      .from("payments")
      .select("id, status")
      .in("booking_id", chunk);
    if (payListErr) throw payListErr;

    const deletablePayments = (payments ?? []).filter(
      (p) => !isPaidProductionPaymentStatus(p.status),
    );
    const paymentIds = deletablePayments.map((p) => p.id);
    if (paymentIds.length > 0) {
      await client.from("payment_events").delete().in("payment_id", paymentIds);
      const { error: payDelErr } = await client.from("payments").delete().in("id", paymentIds);
      if (payDelErr) throw payDelErr;
      paymentsDeleted += paymentIds.length;
    }

    await client.from("booking_locks").delete().in("booking_id", chunk);
    const { error: bookingDelErr } = await client.from("bookings").delete().in("id", chunk);
    if (bookingDelErr) throw bookingDelErr;
    bookingsDeleted += chunk.length;
  }

  return { paymentsDeleted, bookingsDeleted };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {Awaited<import('./mock-data-loader.mjs').runMockDataAudit>} audit
 */
export async function purgeMockDataFromAudit(client, audit) {
  const adminProfileId = await resolveOpsAdminProfileId(client);

  const summary = {
    bookingsHardDeleted: 0,
    bookingsArchived: 0,
    bookingsDeleted: 0,
    paymentsDeleted: 0,
    customersDeleted: 0,
    customersAnonymized: 0,
    cleanersPurged: 0,
    profilesDeleted: 0,
    authUsersDeleted: 0,
    operationalAuditsDeleted: 0,
    notificationsDeleted: 0,
    offersCancelled: 0,
    warnings: [],
  };

  const hardDeleteIds = audit.bookings.deletableIds ?? [];
  const archiveIds = audit.bookings.archiveIds ?? [];

  console.log(`  Hard-deleting ${hardDeleteIds.length} booking(s) via admin_hard_delete_booking…`);
  for (const bookingId of hardDeleteIds) {
    try {
      await hardDeleteBooking(client, bookingId, adminProfileId);
      summary.bookingsHardDeleted += 1;
      summary.bookingsDeleted += 1;
      console.log(`    hard_delete ${bookingId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      summary.warnings.push(`hard_delete ${bookingId}: ${message}`);
      await recordOpsAdminDeleteAudit(client, {
        entityType: "booking",
        entityId: bookingId,
        adminProfileId,
        action: "hard_delete",
        outcome: "failed",
        reason: PURGE_REASON,
        blockedReason: message,
      });
    }
  }

  console.log(`  Archiving ${archiveIds.length} mock booking(s) (soft-delete)…`);
  for (const bookingId of archiveIds) {
    try {
      const cancelled = await cancelOpenOffersForBooking(client, bookingId);
      summary.offersCancelled += cancelled;
      await archiveBooking(client, bookingId, adminProfileId);
      summary.bookingsArchived += 1;
      console.log(`    archive ${bookingId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      summary.warnings.push(`archive ${bookingId}: ${message}`);
      await recordOpsAdminDeleteAudit(client, {
        entityType: "booking",
        entityId: bookingId,
        adminProfileId,
        action: "archive",
        outcome: "failed",
        reason: PURGE_REASON,
        blockedReason: message,
      });
    }
  }

  if (summary.bookingsHardDeleted === 0 && hardDeleteIds.length > 0) {
    summary.warnings.push("No hard deletes succeeded; check admin_hard_delete_booking migration.");
  }

  for (const customer of audit.customers.delete) {
    if (!customer.customerId) continue;

    console.log(`  Customer ${customer.email} (${customer.customerId})`);

    const { count: auditCount, error: auditCountErr } = await client
      .from("customer_operational_audit")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", customer.customerId);
    if (auditCountErr) throw auditCountErr;

    if ((auditCount ?? 0) > 0) {
      const { error: delAuditErr } = await client
        .from("customer_operational_audit")
        .delete()
        .eq("customer_id", customer.customerId);
      if (delAuditErr) throw delAuditErr;
      summary.operationalAuditsDeleted += auditCount ?? 0;
    }

    if (customer.email && !customer.email.includes("(no auth")) {
      const { count, error } = await client
        .from("notification_outbox")
        .delete({ count: "exact" })
        .eq("recipient", customer.email);
      if (error) throw error;
      summary.notificationsDeleted += count ?? 0;
    }

    await client.from("booking_locks").delete().eq("customer_id", customer.customerId);

    const { count: remainingBookings, error: remainErr } = await client
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", customer.customerId)
      .is("deleted_at", null);
    if (remainErr) throw remainErr;

    if ((remainingBookings ?? 0) > 0) {
      const { error: anonErr } = await client
        .from("customers")
        .update({
          company_name: `purged_mock_${customer.customerId.slice(0, 8)}`,
          phone: null,
          notes: "[ops_mock_data_purge] anonymized — bookings preserved",
        })
        .eq("id", customer.customerId);
      if (anonErr) throw anonErr;
      summary.customersAnonymized += 1;
      summary.warnings.push(`${customer.email}: preserved ${remainingBookings} booking(s)`);
      await recordOpsAdminDeleteAudit(client, {
        entityType: "customer",
        entityId: customer.customerId,
        adminProfileId,
        action: "archive",
        outcome: "success",
        reason: PURGE_REASON,
        metadata: { anonymized: true, remainingBookings },
      });
      continue;
    }

    const { error: customerDelErr } = await client
      .from("customers")
      .delete()
      .eq("id", customer.customerId);
    if (customerDelErr) throw customerDelErr;

    const { error: profileDelErr } = await client.from("profiles").delete().eq("id", customer.userId);
    if (profileDelErr) throw profileDelErr;

    const email = String(customer.email).toLowerCase().trim();
    if (!PROTECTED_CUSTOMER_EMAILS.has(email) && hasExplicitTestProfileEmail(email)) {
      const { error: authDelErr } = await client.auth.admin.deleteUser(customer.userId);
      if (authDelErr) {
        summary.warnings.push(`auth delete ${customer.userId}: ${authDelErr.message}`);
      } else {
        summary.authUsersDeleted += 1;
      }
    }

    summary.customersDeleted += 1;
    summary.profilesDeleted += 1;
    await recordOpsAdminDeleteAudit(client, {
      entityType: "customer",
      entityId: customer.customerId,
      adminProfileId,
      action: "delete",
      outcome: "success",
      reason: PURGE_REASON,
    });
  }

  for (const cleaner of audit.cleaners.delete) {
    const cleanerId = cleaner.cleanerId;
    const profileId = cleaner.profileId;

    console.log(`  Cleaner ${cleaner.email} (${cleanerId})`);

    await client.from("cleaner_time_off").delete().eq("cleaner_id", cleanerId);
    await client.from("cleaner_availability").delete().eq("cleaner_id", cleanerId);
    await client.from("cleaner_service_capabilities").delete().eq("cleaner_id", cleanerId);
    await client.from("cleaner_service_areas").delete().eq("cleaner_id", cleanerId);

    const cancelledOffers = await cancelOpenOffersForCleaner(client, cleanerId);
    summary.offersCancelled += cancelledOffers;

    const { data: earnings, error: earnErr } = await client
      .from("earning_lines")
      .select("id, payout_batch_id")
      .eq("cleaner_id", cleanerId);
    if (earnErr) throw earnErr;
    const deletable = (earnings ?? []).filter((e) => !e.payout_batch_id).map((e) => e.id);
    if (deletable.length > 0) {
      await client.from("earning_lines").delete().in("id", deletable);
    }

    await client.from("booking_cleaners").delete().eq("cleaner_id", cleanerId);
    await client.from("bookings").update({ cleaner_id: null }).eq("cleaner_id", cleanerId);

    const { count: auditCount, error: auditCountErr } = await client
      .from("cleaner_operational_audit")
      .select("id", { count: "exact", head: true })
      .eq("cleaner_id", cleanerId);
    if (auditCountErr) throw auditCountErr;

    let cleanerAction = "delete";
    if ((auditCount ?? 0) === 0) {
      const { error: cleanerDelErr } = await client.from("cleaners").delete().eq("id", cleanerId);
      if (cleanerDelErr) throw cleanerDelErr;
    } else {
      cleanerAction = "archive";
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

    const email = cleaner.email?.toLowerCase().trim() ?? "";
    if (hasExplicitTestProfileEmail(email)) {
      const { error: authDelErr } = await client.auth.admin.deleteUser(profileId);
      if (authDelErr) {
        await client.auth.admin.updateUserById(profileId, {
          email: `purged+${profileId}@invalid.local`,
          password: `Purged-${crypto.randomUUID()}-!`,
          email_confirm: true,
        });
        summary.warnings.push(`auth invalidate ${profileId}: ${authDelErr.message}`);
      } else {
        summary.authUsersDeleted += 1;
      }
    }

    const { error: profileDelErr } = await client.from("profiles").delete().eq("id", profileId);
    if (profileDelErr) throw profileDelErr;

    summary.cleanersPurged += 1;
    summary.profilesDeleted += 1;
    await recordOpsAdminDeleteAudit(client, {
      entityType: "cleaner",
      entityId: cleanerId,
      adminProfileId,
      action: cleanerAction,
      outcome: "success",
      reason: PURGE_REASON,
    });
  }

  for (const profile of audit.profiles.orphanDelete) {
    const email = profile.email?.toLowerCase().trim() ?? "";
    const { error: profileDelErr } = await client
      .from("profiles")
      .delete()
      .eq("id", profile.profileId);
    if (profileDelErr) {
      summary.warnings.push(`orphan profile ${profile.profileId}: ${profileDelErr.message}`);
      continue;
    }
    summary.profilesDeleted += 1;

    if (hasExplicitTestProfileEmail(email)) {
      const { error: authDelErr } = await client.auth.admin.deleteUser(profile.profileId);
      if (authDelErr) {
        summary.warnings.push(`auth delete orphan ${profile.profileId}: ${authDelErr.message}`);
      } else {
        summary.authUsersDeleted += 1;
      }
    }
  }

  return summary;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} cleanerId
 */
async function cancelOpenOffersForCleaner(client, cleanerId) {
  const { data: offers, error } = await client
    .from("assignment_offers")
    .select("id, status")
    .eq("cleaner_id", cleanerId);
  if (error) throw error;
  const openIds = (offers ?? [])
    .filter((o) => !["cancelled", "declined", "expired"].includes(String(o.status)))
    .map((o) => o.id);
  if (openIds.length === 0) return 0;
  const { error: updErr } = await client
    .from("assignment_offers")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .in("id", openIds);
  if (updErr) throw updErr;
  return openIds.length;
}

export { deleteBookingDependenciesLegacy };
