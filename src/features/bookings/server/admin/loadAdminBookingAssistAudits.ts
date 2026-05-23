import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database/types";
import type { AdminBookingAssistAuditAction } from "./recordAdminBookingAssistAudit";

export type AdminBookingAssistAuditRow = {
  id: string;
  adminProfileId: string;
  customerId: string;
  bookingId: string | null;
  action: AdminBookingAssistAuditAction | string;
  idempotencyKey: string;
  payload: Json;
  createdAt: string;
};

export async function loadAdminBookingAssistAudits(
  client: SupabaseClient<Database>,
  bookingId: string,
): Promise<AdminBookingAssistAuditRow[]> {
  const { data, error } = await client
    .from("admin_booking_assist_audit")
    .select(
      "id, admin_profile_id, customer_id, booking_id, action, idempotency_key, payload, created_at",
    )
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    adminProfileId: row.admin_profile_id,
    customerId: row.customer_id,
    bookingId: row.booking_id,
    action: row.action,
    idempotencyKey: row.idempotency_key,
    payload: row.payload,
    createdAt: row.created_at,
  }));
}
