import type { BookingStatus } from "@/features/bookings/server/types";

export const ADMIN_OPERATIONAL_ACTIONS = [
  "assignment_recovery",
  "manual_dispatch_offer",
  "replace_open_offer",
  "notification_requeue",
] as const;

export type AdminOperationalAction = (typeof ADMIN_OPERATIONAL_ACTIONS)[number];

export const ADMIN_OPERATIONAL_OUTCOMES = [
  "success",
  "idempotent",
  "rejected",
  "failed",
] as const;

export type AdminOperationalOutcome = (typeof ADMIN_OPERATIONAL_OUTCOMES)[number];

export type AdminOperationalAuditRow = {
  id: string;
  booking_id: string;
  admin_profile_id: string;
  action: AdminOperationalAction;
  outcome: AdminOperationalOutcome;
  reason: string | null;
  result_code: string | null;
  cleaner_id: string | null;
  offer_id: string | null;
  cancelled_offer_id: string | null;
  idempotency_key: string | null;
  booking_status_before: string | null;
  booking_status_after: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type RecordAdminOperationalAuditInput = {
  bookingId: string;
  adminProfileId: string;
  action: AdminOperationalAction;
  outcome: AdminOperationalOutcome;
  reason?: string | null;
  resultCode?: string | null;
  cleanerId?: string | null;
  offerId?: string | null;
  cancelledOfferId?: string | null;
  idempotencyKey?: string | null;
  bookingStatusBefore?: BookingStatus | string | null;
  bookingStatusAfter?: BookingStatus | string | null;
  metadata?: Record<string, unknown> | null;
};
