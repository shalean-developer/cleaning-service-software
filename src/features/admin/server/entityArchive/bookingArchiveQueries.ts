import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingRow, Database } from "@/lib/database/types";

const ACTIVE_ASSIGNMENT_STATUSES = ["assigned", "in_progress"] as const;
const COMPLETED_LIFECYCLE_STATUSES = ["completed", "payout_ready", "paid_out"] as const;

export type BookingArchiveBlockers = {
  hasPaidPayment: boolean;
  hasEarningLines: boolean;
  isCompletedLifecycle: boolean;
  hasActiveAssignment: boolean;
  paidPaymentCount: number;
  earningLineCount: number;
};

export async function loadBookingForArchive(
  client: SupabaseClient<Database>,
  bookingId: string,
): Promise<BookingRow | null> {
  const { data, error } = await client.from("bookings").select("*").eq("id", bookingId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function assessBookingArchiveBlockers(
  client: SupabaseClient<Database>,
  booking: BookingRow,
): Promise<BookingArchiveBlockers> {
  const [{ count: paidCount }, { count: earningCount }] = await Promise.all([
    client
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("booking_id", booking.id)
      .eq("status", "paid"),
    client
      .from("earning_lines")
      .select("*", { count: "exact", head: true })
      .eq("booking_id", booking.id),
  ]);

  const hasPaidPayment = (paidCount ?? 0) > 0;
  const hasEarningLines = (earningCount ?? 0) > 0;
  const isCompletedLifecycle = (COMPLETED_LIFECYCLE_STATUSES as readonly string[]).includes(
    booking.status,
  );
  const hasActiveAssignment = (ACTIVE_ASSIGNMENT_STATUSES as readonly string[]).includes(
    booking.status,
  );

  return {
    hasPaidPayment,
    hasEarningLines,
    isCompletedLifecycle,
    hasActiveAssignment,
    paidPaymentCount: paidCount ?? 0,
    earningLineCount: earningCount ?? 0,
  };
}

export function summarizeBookingDeleteBlockReason(
  blockers: BookingArchiveBlockers,
): string | null {
  const parts: string[] = [];
  if (blockers.hasPaidPayment) parts.push("successful payment");
  if (blockers.hasEarningLines) parts.push("payout/earning lines");
  if (blockers.isCompletedLifecycle) parts.push("completed lifecycle status");
  if (blockers.hasActiveAssignment) parts.push("active assignment");
  if (parts.length === 0) return null;
  return parts.join(", ");
}

export function bookingDeleteBlocked(blockers: BookingArchiveBlockers): boolean {
  return (
    blockers.hasPaidPayment ||
    blockers.hasEarningLines ||
    blockers.isCompletedLifecycle ||
    blockers.hasActiveAssignment
  );
}

export function bookingArchiveBlocked(blockers: BookingArchiveBlockers): boolean {
  return blockers.hasActiveAssignment;
}
