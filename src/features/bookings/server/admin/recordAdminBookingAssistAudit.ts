import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database/types";

export const ADMIN_BOOKING_ASSIST_AUDIT_ACTIONS = [
  "admin_booking_draft_created",
  "admin_booking_draft_rejected",
  "admin_booking_draft_idempotency_replayed",
  "admin_booking_pending_payment_created",
  "admin_booking_pending_payment_rejected",
  "admin_booking_pending_payment_idempotency_replayed",
  "admin_booking_payment_link_generated",
  "admin_booking_payment_link_regenerated",
  "admin_booking_payment_link_expired",
  "admin_booking_payment_request_copied",
  "admin_booking_payment_request_sent",
  "admin_booking_payment_link_rejected",
  "admin_booking_payment_link_idempotency_replayed",
  "admin_booking_offline_payment_recorded",
  "admin_booking_offline_payment_rejected",
  "admin_booking_offline_payment_idempotency_replayed",
] as const;

export type AdminBookingAssistAuditAction =
  (typeof ADMIN_BOOKING_ASSIST_AUDIT_ACTIONS)[number];

export type RecordAdminBookingAssistAuditInput = {
  adminProfileId: string;
  customerId: string;
  bookingId?: string | null;
  action: AdminBookingAssistAuditAction;
  idempotencyKey: string;
  payload: Json;
};

export async function recordAdminBookingAssistAudit(
  client: SupabaseClient<Database>,
  input: RecordAdminBookingAssistAuditInput,
): Promise<string | null> {
  const { data, error } = await client
    .from("admin_booking_assist_audit")
    .insert({
      admin_profile_id: input.adminProfileId,
      customer_id: input.customerId,
      booking_id: input.bookingId ?? null,
      action: input.action,
      idempotency_key: input.idempotencyKey.trim(),
      payload: input.payload,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data?.id ?? null;
}
