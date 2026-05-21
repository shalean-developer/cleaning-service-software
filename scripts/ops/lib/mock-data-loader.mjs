import {
  countCustomerRelatedRowsForAudit,
  countNotificationsForRecipient,
  enrichCustomerAuditRow,
  loadCustomerCandidates,
} from "./mock-customer-data.mjs";
import {
  countCleanerRelatedRows,
  formatRelatedSummary,
  listAuthEmailsByProfileId,
  loadCleanerCandidates,
  summarizeBookingsForCleaner,
} from "./mock-cleaner-data.mjs";
import {
  classifyMockProfile,
  resolveMockProfileDecision,
} from "./mock-profile-patterns.mjs";
import {
  classifyMockBookingSignals,
  extractBookingFieldSignals,
  isCompletedPayoutEarning,
  isPaidProductionPaymentStatus,
  resolveMockBookingDecision,
  resolveMockCleanerDecision,
} from "./mock-patterns.mjs";

const CHUNK = 100;
const BOOKING_PAGE = 500;

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string[]} bookingIds
 */
async function countBookingScopedImpacts(client, bookingIds) {
  if (bookingIds.length === 0) {
    return {
      payments: 0,
      paymentsDeletable: 0,
      earnings: 0,
      earningsBlocked: 0,
      dispatchOffers: 0,
      payoutItems: 0,
      bookingStateAudit: 0,
      bookingCleaners: 0,
      bookingLocks: 0,
    };
  }

  let payments = 0;
  let paymentsDeletable = 0;
  let earnings = 0;
  let earningsBlocked = 0;
  let dispatchOffers = 0;
  let payoutItems = 0;
  let bookingStateAudit = 0;
  let bookingCleaners = 0;
  let bookingLocks = 0;

  for (let i = 0; i < bookingIds.length; i += CHUNK) {
    const chunk = bookingIds.slice(i, i + CHUNK);

    const countIn = async (table, column = "booking_id") => {
      const { count, error } = await client
        .from(table)
        .select("id", { count: "exact", head: true })
        .in(column, chunk);
      if (error) throw error;
      return count ?? 0;
    };

    dispatchOffers += await countIn("assignment_offers");
    bookingStateAudit += await countIn("booking_state_audit");
    bookingCleaners += await countIn("booking_cleaners");
    bookingLocks += await countIn("booking_locks");

    const { data: paymentRows, error: payErr } = await client
      .from("payments")
      .select("id, status")
      .in("booking_id", chunk);
    if (payErr) throw payErr;
    for (const p of paymentRows ?? []) {
      payments += 1;
      if (!isPaidProductionPaymentStatus(p.status)) paymentsDeletable += 1;
    }

    const { data: earningRows, error: earnErr } = await client
      .from("earning_lines")
      .select("id, payout_status, payout_batch_id")
      .in("booking_id", chunk);
    if (earnErr) throw earnErr;
    for (const el of earningRows ?? []) {
      earnings += 1;
      if (isCompletedPayoutEarning(el.payout_status, el.payout_batch_id)) {
        earningsBlocked += 1;
        if (el.payout_batch_id) payoutItems += 1;
      }
    }
  }

  return {
    payments,
    paymentsDeletable,
    earnings,
    earningsBlocked,
    dispatchOffers,
    payoutItems,
    bookingStateAudit,
    bookingCleaners,
    bookingLocks,
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
async function loadAllBookings(client) {
  /** @type {Array<Record<string, unknown>>} */
  const rows = [];
  let from = 0;
  for (;;) {
    const { data, error } = await client
      .from("bookings")
      .select("id, customer_id, cleaner_id, status, metadata")
      .range(from, from + BOOKING_PAGE - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < BOOKING_PAGE) break;
    from += BOOKING_PAGE;
  }
  return rows;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string[]} bookingIds
 */
async function loadBookingPaymentFlags(client, bookingIds) {
  /** @type {Map<string, { hasPaidPayment: boolean; hasCompletedPayoutEarning: boolean }>} */
  const flags = new Map();
  if (bookingIds.length === 0) return flags;

  for (let i = 0; i < bookingIds.length; i += CHUNK) {
    const chunk = bookingIds.slice(i, i + CHUNK);
    const { data: payments, error: payErr } = await client
      .from("payments")
      .select("booking_id, status")
      .in("booking_id", chunk);
    if (payErr) throw payErr;
    for (const p of payments ?? []) {
      const cur = flags.get(p.booking_id) ?? {
        hasPaidPayment: false,
        hasCompletedPayoutEarning: false,
      };
      if (isPaidProductionPaymentStatus(p.status)) cur.hasPaidPayment = true;
      flags.set(p.booking_id, cur);
    }

    const { data: earnings, error: earnErr } = await client
      .from("earning_lines")
      .select("booking_id, payout_status, payout_batch_id")
      .in("booking_id", chunk);
    if (earnErr) throw earnErr;
    for (const el of earnings ?? []) {
      if (!el.booking_id) continue;
      const cur = flags.get(el.booking_id) ?? {
        hasPaidPayment: false,
        hasCompletedPayoutEarning: false,
      };
      if (isCompletedPayoutEarning(el.payout_status, el.payout_batch_id)) {
        cur.hasCompletedPayoutEarning = true;
      }
      flags.set(el.booking_id, cur);
    }
  }

  return flags;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
export async function runMockDataAudit(client) {
  const authEmails = await listAuthEmailsByProfileId(client);

  const { data: allProfiles, error: profileErr } = await client
    .from("profiles")
    .select("id, role, full_name");
  if (profileErr) throw profileErr;

  /** @type {Map<string, { mock: boolean; reasons: string[]; protected: boolean }>} */
  const profileClassById = new Map();
  const profileRows = [];

  for (const profile of allProfiles ?? []) {
    const email = authEmails.get(profile.id) ?? null;
    const classification = classifyMockProfile({
      email,
      fullName: profile.full_name,
      role: profile.role,
    });
    profileClassById.set(profile.id, classification);
    profileRows.push({
      profileId: profile.id,
      email: email ?? "(no auth email)",
      fullName: profile.full_name,
      role: profile.role,
      classification,
      decision: resolveMockProfileDecision(classification),
      match: classification.reasons.join(",") || "-",
    });
  }

  const customerCandidates = await loadCustomerCandidates(client, profileClassById);
  const customerRows = [];

  for (const row of customerCandidates) {
    if (!row.customerId) {
      customerRows.push(
        enrichCustomerAuditRow(row, {
          bookingCount: 0,
          paymentCount: 0,
          paidPaymentCount: 0,
          recurringCount: 0,
          bookingLocks: 0,
          customerOperationalAudit: 0,
          bookingIds: [],
          bookingRows: [],
        }, 0),
      );
      continue;
    }

    const related = await countCustomerRelatedRowsForAudit(client, row.customerId, {
      classification: row.classification,
    });
    const notificationCount = row.classification.mock
      ? await countNotificationsForRecipient(client, row.email)
      : 0;
    customerRows.push(enrichCustomerAuditRow(row, related, notificationCount));
  }

  const cleanerCandidates = await loadCleanerCandidates(client, profileClassById);
  const cleanerRows = [];

  for (const row of cleanerCandidates) {
    const related = await countCleanerRelatedRows(client, row.cleanerId);
    const bookingSummary = await summarizeBookingsForCleaner(client, row.cleanerId);
    const alreadyPurged =
      row.deletedAt != null && row.lifecycleReason === "ops_mock_cleaner_purge";
    const decision = resolveMockCleanerDecision({
      classification: row.classification,
      paidRealCustomerBookings: bookingSummary.paidRealCustomer,
      alreadyPurged,
    });
    cleanerRows.push({
      ...row,
      related,
      bookingSummary,
      relatedSummary: formatRelatedSummary(related, bookingSummary),
      decision,
      match: row.classification.reasons.join(",") || "-",
    });
  }

  const deleteCustomers = customerRows.filter((r) => r.decision === "DELETE");
  const reviewCustomers = customerRows.filter((r) => r.decision === "REVIEW");
  const keepCustomers = customerRows.filter((r) => r.decision === "KEEP");
  const purgedCustomers = customerRows.filter((r) => r.decision === "PURGED");

  const deleteCleaners = cleanerRows.filter((r) => r.decision === "DELETE");
  const reviewCleaners = cleanerRows.filter((r) => r.decision === "REVIEW");
  const keepCleaners = cleanerRows.filter((r) => r.decision === "KEEP");
  const purgedCleaners = cleanerRows.filter((r) => r.decision === "PURGED");

  const mockCustomerIds = new Set(
    deleteCustomers.map((r) => r.customerId).filter(Boolean),
  );
  const mockCleanerIds = new Set(deleteCleaners.map((r) => r.cleanerId).filter(Boolean));

  const customerClassById = new Map(
    customerRows.filter((r) => r.customerId).map((r) => [r.customerId, r.classification]),
  );

  const allBookings = await loadAllBookings(client);
  const bookingIds = allBookings.map((b) => String(b.id));
  const paymentFlags = await loadBookingPaymentFlags(client, bookingIds);

  const bookingAuditRows = [];
  let paidProductionBlocked = 0;

  for (const booking of allBookings) {
    const id = String(booking.id);
    const customerId = booking.customer_id ? String(booking.customer_id) : null;
    const cleanerId = booking.cleaner_id ? String(booking.cleaner_id) : null;
    const cc = customerClassById.get(customerId) ?? {
      mock: false,
      reasons: [],
      strong: false,
    };
    const extracted = extractBookingFieldSignals(
      /** @type {Record<string, unknown> | null} */ (booking.metadata),
    );
    const flags = paymentFlags.get(id) ?? {
      hasPaidPayment: false,
      hasCompletedPayoutEarning: false,
    };

    const signals = classifyMockBookingSignals({
      metadata: /** @type {Record<string, unknown> | null} */ (booking.metadata),
      serviceUid: extracted.serviceUid,
      customerEmail: extracted.customerEmail,
      customerName: extracted.customerName,
      customerId,
      cleanerId,
      mockCustomerIds,
      mockCleanerIds,
    });

    const decision = resolveMockBookingDecision({
      status: String(booking.status),
      metadata: /** @type {Record<string, unknown> | null} */ (booking.metadata),
      serviceUid: extracted.serviceUid,
      customerEmail: extracted.customerEmail,
      customerName: extracted.customerName,
      customerId,
      cleanerId,
      customerClassification: cc,
      mockCustomerIds,
      mockCleanerIds,
      hasPaidPayment: flags.hasPaidPayment,
      hasCompletedPayoutEarning: flags.hasCompletedPayoutEarning,
    });

    if (decision === "REVIEW" && flags.hasPaidPayment) paidProductionBlocked += 1;

    bookingAuditRows.push({
      bookingId: id,
      customerId,
      cleanerId,
      status: booking.status,
      serviceUid: extracted.serviceUid,
      customerEmail: extracted.customerEmail,
      customerName: extracted.customerName,
      signals,
      decision,
      hasPaidPayment: flags.hasPaidPayment,
      match: signals.reasons.join(",") || "-",
    });
  }

  const deleteBookings = bookingAuditRows.filter((b) => b.decision === "DELETE");
  const reviewBookings = bookingAuditRows.filter((b) => b.decision === "REVIEW");
  const keepBookings = bookingAuditRows.filter((b) => b.decision === "KEEP");

  const deletableBookingIds = [...new Set(deleteBookings.map((b) => b.bookingId))];
  const bookingImpacts = await countBookingScopedImpacts(client, deletableBookingIds);

  const deleteProfiles = profileRows.filter((p) => p.decision === "DELETE");
  const reviewProfiles = profileRows.filter((p) => p.decision === "REVIEW");
  const keepProfiles = profileRows.filter((p) => p.decision === "KEEP");

  const profileIdsWithEntity = new Set([
    ...customerRows.map((r) => r.userId),
    ...cleanerRows.map((r) => r.profileId),
  ]);
  const orphanMockProfiles = deleteProfiles.filter(
    (p) => !profileIdsWithEntity.has(p.profileId),
  );

  let customerOperationalAudits = 0;
  for (const customerId of mockCustomerIds) {
    const { count, error } = await client
      .from("customer_operational_audit")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", customerId);
    if (error) throw error;
    customerOperationalAudits += count ?? 0;
  }

  let notificationRows = 0;
  for (const customer of deleteCustomers) {
    notificationRows += customer.notificationCount ?? 0;
  }

  let cleanerScopedOffers = 0;
  let cleanerScopedEarnings = 0;
  let cleanerScopedPayoutItems = 0;

  for (const cleaner of deleteCleaners) {
    cleanerScopedOffers += cleaner.related.assignment_offers ?? 0;
    cleanerScopedEarnings += cleaner.related.earning_lines ?? 0;
    const { count, error } = await client
      .from("earning_lines")
      .select("id", { count: "exact", head: true })
      .eq("cleaner_id", cleaner.cleanerId)
      .not("payout_batch_id", "is", null);
    if (error) throw error;
    cleanerScopedPayoutItems += count ?? 0;
  }

  const safetyViolations = [];

  for (const row of deleteCustomers) {
    if (row.paidProductionBookings > 0) {
      safetyViolations.push(
        `DELETE customer ${row.email} has ${row.paidProductionBookings} paid production booking(s)`,
      );
    }
    if (!row.classification.mock) {
      safetyViolations.push(`DELETE customer ${row.email} is not classified as mock`);
    }
  }

  for (const row of deleteCleaners) {
    if ((row.bookingSummary?.paidRealCustomer ?? 0) > 0) {
      safetyViolations.push(
        `DELETE cleaner ${row.email} has ${row.bookingSummary.paidRealCustomer} paid real-customer booking(s)`,
      );
    }
  }

  for (const row of deleteBookings) {
    if (!row.hasPaidPayment) continue;
    const cc = customerClassById.get(row.customerId);
    const strongCustomer =
      cc?.strong === true || (row.customerId && mockCustomerIds.has(row.customerId));
    if (!strongCustomer) {
      safetyViolations.push(
        `DELETE booking ${row.bookingId} has paid payment but weak mock classification`,
      );
    }
  }

  const protectedKeepCount =
    keepProfiles.length +
    keepCustomers.length +
    keepCleaners.length +
    keepBookings.length;

  const reviewCount =
    reviewProfiles.length +
    reviewCustomers.length +
    reviewCleaners.length +
    reviewBookings.length;

  return {
    profiles: {
      delete: deleteProfiles,
      review: reviewProfiles,
      keep: keepProfiles,
      orphanDelete: orphanMockProfiles,
      all: profileRows,
    },
    customers: {
      delete: deleteCustomers,
      review: reviewCustomers,
      keep: keepCustomers,
      purged: purgedCustomers,
      all: customerRows,
    },
    cleaners: {
      delete: deleteCleaners,
      review: reviewCleaners,
      keep: keepCleaners,
      purged: purgedCleaners,
      all: cleanerRows,
    },
    bookings: {
      delete: deleteBookings,
      review: reviewBookings,
      keep: keepBookings,
      deletableIds: deletableBookingIds,
      deletableCount: deletableBookingIds.length,
      impacts: bookingImpacts,
    },
    impacts: {
      mockProfilesToDelete: deleteProfiles.length,
      mockCustomersToDelete: deleteCustomers.length,
      mockBookingsToDelete: deletableBookingIds.length,
      mockCleanersToDelete: deleteCleaners.length,
      orphanProfilesToDelete: orphanMockProfiles.length,
      paymentsAffected: bookingImpacts.payments,
      paymentsDeletable: bookingImpacts.paymentsDeletable,
      earningsAffected: bookingImpacts.earnings + cleanerScopedEarnings,
      earningsBlocked: bookingImpacts.earningsBlocked,
      dispatchOffersAffected: bookingImpacts.dispatchOffers + cleanerScopedOffers,
      payoutItemsAffected: bookingImpacts.payoutItems + cleanerScopedPayoutItems,
      bookingStateAuditAffected: bookingImpacts.bookingStateAudit,
      bookingLocksAffected: bookingImpacts.bookingLocks,
      bookingCleanersAffected: bookingImpacts.bookingCleaners,
      customerOperationalAuditsAffected: customerOperationalAudits,
      notificationsAffected: notificationRows,
      protectedKeepCount,
      reviewCount,
      paidProductionBlockedCount: paidProductionBlocked,
    },
    safetyViolations,
    scanned: {
      profiles: allProfiles?.length ?? 0,
      customers: customerCandidates.length,
      cleaners: cleanerCandidates.length,
      bookings: allBookings.length,
    },
  };
}

/**
 * @param {Awaited<ReturnType<typeof runMockDataAudit>>} audit
 */
export function assertDeleteBucketSafe(audit) {
  if (audit.safetyViolations.length === 0) return;
  throw new Error(
    `Unsafe DELETE bucket — aborting:\n${audit.safetyViolations.map((v) => `  - ${v}`).join("\n")}`,
  );
}
