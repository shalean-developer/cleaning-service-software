import { isPaidProductionPaymentStatus } from "./mock-patterns.mjs";
import { PROTECTED_CUSTOMER_EMAILS } from "./mock-customer-patterns.mjs";
import { hasExplicitTestProfileEmail } from "./mock-profile-patterns.mjs";

const CHUNK = 50;

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string[]} bookingIds
 */
async function deleteBookingDependencies(client, bookingIds) {
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
  const summary = {
    bookingsDeleted: 0,
    paymentsDeleted: 0,
    customersDeleted: 0,
    customersAnonymized: 0,
    cleanersPurged: 0,
    profilesDeleted: 0,
    authUsersDeleted: 0,
    operationalAuditsDeleted: 0,
    notificationsDeleted: 0,
    warnings: [],
  };

  const bookingIds = audit.bookings.deletableIds;
  console.log(`  Removing ${bookingIds.length} mock booking(s) and dependencies…`);
  const bookingResult = await deleteBookingDependencies(client, bookingIds);
  summary.bookingsDeleted = bookingResult.bookingsDeleted;
  summary.paymentsDeleted = bookingResult.paymentsDeleted;

  for (const customer of audit.customers.delete) {
    if (!customer.customerId) continue;

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
      .eq("customer_id", customer.customerId);
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
    if (
      !PROTECTED_CUSTOMER_EMAILS.has(email) &&
      hasExplicitTestProfileEmail(email)
    ) {
      const { error: authDelErr } = await client.auth.admin.deleteUser(customer.userId);
      if (authDelErr) {
        summary.warnings.push(`auth delete ${customer.userId}: ${authDelErr.message}`);
      } else {
        summary.authUsersDeleted += 1;
      }
    }

    summary.customersDeleted += 1;
    summary.profilesDeleted += 1;
  }

  for (const cleaner of audit.cleaners.delete) {
    const cleanerId = cleaner.cleanerId;
    const profileId = cleaner.profileId;

    await client.from("cleaner_time_off").delete().eq("cleaner_id", cleanerId);
    await client.from("cleaner_availability").delete().eq("cleaner_id", cleanerId);
    await client.from("cleaner_service_capabilities").delete().eq("cleaner_id", cleanerId);
    await client.from("cleaner_service_areas").delete().eq("cleaner_id", cleanerId);
    await client.from("assignment_offers").delete().eq("cleaner_id", cleanerId);

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

    if ((auditCount ?? 0) === 0) {
      await client.from("cleaners").delete().eq("id", cleanerId);
    } else {
      await client
        .from("cleaners")
        .update({
          active: false,
          deleted_at: new Date().toISOString(),
          lifecycle_reason: "ops_mock_cleaner_purge",
        })
        .eq("id", cleanerId);
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
