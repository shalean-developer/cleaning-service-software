/**
 * Booking domain types. Persistence (Supabase) maps to these shapes.
 * All lifecycle writes must go through {@link executeBookingCommand}.
 */

export type BookingId = string;

/** Canonical booking lifecycle states. aligned with `public.booking_status`. */
export const BOOKING_STATUSES = [
  "draft",
  "pending_payment",
  "confirmed",
  "pending_assignment",
  "assigned",
  "in_progress",
  "completed",
  "payout_ready",
  "paid_out",
  "cancelled",
  "payment_failed",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** Pre-persist sentinel used only by guards/tests. not a DB enum value. */
export type BookingLifecyclePhase = "initial" | BookingStatus;
