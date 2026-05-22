import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingRow, Database } from "@/lib/database/types";
import { loadBookingForArchive } from "./bookingArchiveQueries";

/** Statuses that indicate real operational work — not empty/test bookings. */
const BLOCKED_LIFECYCLE_STATUSES = [
  "assigned",
  "in_progress",
  "completed",
  "payout_ready",
  "paid_out",
] as const;

const SAFE_OFFER_TERMINAL_STATUSES = ["cancelled", "declined", "expired"] as const;

/** Paid or refunded payments — abandoned checkout rows do not block hard delete. */
const SETTLED_PAYMENT_STATUSES = ["paid", "refunded"] as const;

export type BookingHardDeleteBlockers = {
  settledPaymentCount: number;
  earningLineCount: number;
  assignmentOfferCount: number;
  nonTerminalOfferCount: number;
  bookingCleanerCount: number;
  supportRequestCount: number;
  recurringSeriesCount: number;
  recurringGroupAnchorCount: number;
  hasAssignedCleaner: boolean;
  hasSeriesId: boolean;
  isSyntheticAnchor: boolean;
  isBlockedLifecycleStatus: boolean;
  lifecycleStatus: string;
};

export type BookingHardDeleteEligibility = {
  hardDeleteAllowed: boolean;
  blockedReasons: string[];
  blockers: BookingHardDeleteBlockers;
};

export async function loadBookingForHardDelete(
  client: SupabaseClient<Database>,
  bookingId: string,
): Promise<BookingRow | null> {
  return loadBookingForArchive(client, bookingId);
}

export async function assessBookingHardDeleteEligibility(
  client: SupabaseClient<Database>,
  booking: BookingRow,
): Promise<BookingHardDeleteEligibility> {
  const blockers = await gatherBookingHardDeleteBlockers(client, booking);
  const blockedReasons = buildBookingHardDeleteBlockedReasons(blockers, booking);
  return {
    hardDeleteAllowed: blockedReasons.length === 0,
    blockedReasons,
    blockers,
  };
}

function buildBookingHardDeleteBlockedReasons(
  blockers: BookingHardDeleteBlockers,
  booking: BookingRow,
): string[] {
  const isArchived = booking.deleted_at != null;
  const reasons: string[] = [];

  if (blockers.earningLineCount > 0) {
    reasons.push("earning or payout lines exist");
  }

  if (blockers.hasSeriesId) {
    reasons.push("booking is linked to a recurring series");
  }
  if (blockers.isSyntheticAnchor) {
    reasons.push("booking is a recurring synthetic anchor");
  }
  if (blockers.recurringSeriesCount > 0) {
    reasons.push("booking is the source of a recurring series");
  }
  if (blockers.recurringGroupAnchorCount > 0) {
    reasons.push("booking is a recurring schedule group anchor");
  }

  if (isArchived) {
    return reasons;
  }

  if (blockers.settledPaymentCount > 0) {
    reasons.push("paid or refunded payment exists");
  }
  if (blockers.hasAssignedCleaner) {
    reasons.push("cleaner is assigned on the booking");
  }
  if (blockers.bookingCleanerCount > 0) {
    reasons.push("team roster rows exist");
  }
  if (blockers.nonTerminalOfferCount > 0) {
    reasons.push("active or non-terminal assignment offers exist");
  }
  if (blockers.isBlockedLifecycleStatus) {
    reasons.push(`lifecycle status is ${booking.status}`);
  }
  if (blockers.supportRequestCount > 0) {
    reasons.push("support requests exist for this booking");
  }

  return reasons;
}

async function gatherBookingHardDeleteBlockers(
  client: SupabaseClient<Database>,
  booking: BookingRow,
): Promise<BookingHardDeleteBlockers> {
  const [
    settledPaymentCount,
    earningLineCount,
    offers,
    bookingCleanerCount,
    supportRequestCount,
    recurringSeriesCount,
    recurringGroupAnchorCount,
  ] = await Promise.all([
    countSettledPayments(client, booking.id),
    countEq(client, "earning_lines", "booking_id", booking.id),
    listOffers(client, booking.id),
    countEq(client, "booking_cleaners", "booking_id", booking.id),
    countEq(client, "booking_support_requests", "booking_id", booking.id),
    countEq(client, "booking_series", "created_from_booking_id", booking.id),
    countEq(client, "recurring_schedule_groups", "anchor_booking_id", booking.id),
  ]);

  const assignmentOfferCount = offers.length;
  const nonTerminalOfferCount = offers.filter(
    (o) => !(SAFE_OFFER_TERMINAL_STATUSES as readonly string[]).includes(o.status),
  ).length;

  return {
    settledPaymentCount,
    earningLineCount,
    assignmentOfferCount,
    nonTerminalOfferCount,
    bookingCleanerCount,
    supportRequestCount,
    recurringSeriesCount,
    recurringGroupAnchorCount,
    hasAssignedCleaner: booking.cleaner_id != null,
    hasSeriesId: booking.series_id != null,
    isSyntheticAnchor: booking.synthetic_anchor,
    isBlockedLifecycleStatus: (BLOCKED_LIFECYCLE_STATUSES as readonly string[]).includes(
      booking.status,
    ),
    lifecycleStatus: booking.status,
  };
}

async function countSettledPayments(
  client: SupabaseClient<Database>,
  bookingId: string,
): Promise<number> {
  const { count, error } = await client
    .from("payments")
    .select("*", { count: "exact", head: true })
    .eq("booking_id", bookingId)
    .in("status", [...SETTLED_PAYMENT_STATUSES]);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function countEq(
  client: SupabaseClient<Database>,
  table:
    | "payments"
    | "earning_lines"
    | "booking_cleaners"
    | "booking_support_requests"
    | "booking_series"
    | "recurring_schedule_groups",
  column: string,
  value: string,
): Promise<number> {
  const { count, error } = await client
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(column, value);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function listOffers(
  client: SupabaseClient<Database>,
  bookingId: string,
): Promise<{ status: string }[]> {
  const { data, error } = await client
    .from("assignment_offers")
    .select("status")
    .eq("booking_id", bookingId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export function summarizeBookingHardDeleteBlockedReason(
  blockedReasons: string[],
): string | null {
  if (blockedReasons.length === 0) return null;
  return blockedReasons.join("; ");
}
