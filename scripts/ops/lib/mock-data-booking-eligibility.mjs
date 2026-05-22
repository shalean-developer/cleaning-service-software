/**
 * Mirrors src/features/admin/server/entityArchive/bookingHardDeleteQueries.ts
 * for ops mock-data cleanup (no server-only imports).
 */

const BLOCKED_LIFECYCLE_STATUSES = [
  "assigned",
  "in_progress",
  "completed",
  "payout_ready",
  "paid_out",
];

const SAFE_OFFER_TERMINAL_STATUSES = ["cancelled", "declined", "expired"];
const SETTLED_PAYMENT_STATUSES = ["paid", "refunded"];

const ACTIVE_ASSIGNMENT_STATUSES = ["assigned", "in_progress"];
const COMPLETED_LIFECYCLE_STATUSES = ["completed", "payout_ready", "paid_out"];

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} table
 * @param {string} column
 * @param {string} value
 */
async function countSettledPayments(client, bookingId) {
  const { count, error } = await client
    .from("payments")
    .select("*", { count: "exact", head: true })
    .eq("booking_id", bookingId)
    .in("status", SETTLED_PAYMENT_STATUSES);
  if (error) throw error;
  return count ?? 0;
}

async function countEq(client, table, column, value) {
  const { count, error } = await client
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(column, value);
  if (error) throw error;
  return count ?? 0;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} bookingId
 */
async function listOffers(client, bookingId) {
  const { data, error } = await client
    .from("assignment_offers")
    .select("status")
    .eq("booking_id", bookingId);
  if (error) throw error;
  return data ?? [];
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {Record<string, unknown>} booking
 */
export async function assessBookingHardDeleteEligibility(client, booking) {
  const bookingId = String(booking.id);
  const [
    settledPaymentCount,
    earningLineCount,
    offers,
    bookingCleanerCount,
    supportRequestCount,
    recurringSeriesCount,
    recurringGroupAnchorCount,
  ] = await Promise.all([
    countSettledPayments(client, bookingId),
    countEq(client, "earning_lines", "booking_id", bookingId),
    listOffers(client, bookingId),
    countEq(client, "booking_cleaners", "booking_id", bookingId),
    countEq(client, "booking_support_requests", "booking_id", bookingId),
    countEq(client, "booking_series", "created_from_booking_id", bookingId),
    countEq(client, "recurring_schedule_groups", "anchor_booking_id", bookingId),
  ]);

  const nonTerminalOfferCount = offers.filter(
    (o) => !SAFE_OFFER_TERMINAL_STATUSES.includes(String(o.status)),
  ).length;

  const blockers = {
    settledPaymentCount,
    earningLineCount,
    assignmentOfferCount: offers.length,
    nonTerminalOfferCount,
    bookingCleanerCount,
    supportRequestCount,
    recurringSeriesCount,
    recurringGroupAnchorCount,
    hasAssignedCleaner: booking.cleaner_id != null,
    hasSeriesId: booking.series_id != null,
    isSyntheticAnchor: booking.synthetic_anchor === true,
    isBlockedLifecycleStatus: BLOCKED_LIFECYCLE_STATUSES.includes(String(booking.status)),
    lifecycleStatus: String(booking.status),
  };

  const isArchived = booking.deleted_at != null;
  const blockedReasons = [];
  if (blockers.earningLineCount > 0) blockedReasons.push("earning or payout lines exist");
  if (blockers.hasSeriesId) blockedReasons.push("booking is linked to a recurring series");
  if (blockers.isSyntheticAnchor) blockedReasons.push("booking is a recurring synthetic anchor");
  if (blockers.recurringSeriesCount > 0) {
    blockedReasons.push("booking is the source of a recurring series");
  }
  if (blockers.recurringGroupAnchorCount > 0) {
    blockedReasons.push("booking is a recurring schedule group anchor");
  }
  if (isArchived) {
    return {
      hardDeleteAllowed: blockedReasons.length === 0,
      blockedReasons,
      blockers,
    };
  }
  if (blockers.settledPaymentCount > 0) blockedReasons.push("paid or refunded payment exists");
  if (blockers.hasAssignedCleaner) blockedReasons.push("cleaner is assigned on the booking");
  if (blockers.bookingCleanerCount > 0) blockedReasons.push("team roster rows exist");
  if (blockers.nonTerminalOfferCount > 0) {
    blockedReasons.push("active or non-terminal assignment offers exist");
  }
  if (blockers.isBlockedLifecycleStatus) {
    blockedReasons.push(`lifecycle status is ${blockers.lifecycleStatus}`);
  }
  if (blockers.supportRequestCount > 0) {
    blockedReasons.push("support requests exist for this booking");
  }

  return {
    hardDeleteAllowed: blockedReasons.length === 0,
    blockedReasons,
    blockers,
  };
}

/**
 * Archive is safe only when no paid payment, earnings, completed lifecycle, or active assignment.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {Record<string, unknown>} booking
 */
export async function assessBookingArchiveEligibility(client, booking) {
  const bookingId = String(booking.id);
  const [{ count: paidCount }, { count: earningCount }] = await Promise.all([
    client
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("booking_id", bookingId)
      .eq("status", "paid"),
    client
      .from("earning_lines")
      .select("*", { count: "exact", head: true })
      .eq("booking_id", bookingId),
  ]);

  const blockers = {
    hasPaidPayment: (paidCount ?? 0) > 0,
    hasEarningLines: (earningCount ?? 0) > 0,
    isCompletedLifecycle: COMPLETED_LIFECYCLE_STATUSES.includes(String(booking.status)),
    hasActiveAssignment: ACTIVE_ASSIGNMENT_STATUSES.includes(String(booking.status)),
    paidPaymentCount: paidCount ?? 0,
    earningLineCount: earningCount ?? 0,
  };

  const blockedReasons = [];
  if (blockers.hasPaidPayment) blockedReasons.push("successful payment");
  if (blockers.hasEarningLines) blockedReasons.push("payout/earning lines");
  if (blockers.isCompletedLifecycle) blockedReasons.push("completed lifecycle status");
  if (blockers.hasActiveAssignment) blockedReasons.push("active assignment");

  return {
    archiveAllowed: blockedReasons.length === 0,
    blockedReasons,
    blockers,
  };
}
