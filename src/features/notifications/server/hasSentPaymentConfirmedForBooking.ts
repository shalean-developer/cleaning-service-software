import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { PAYMENT_CONFIRMED_TEMPLATE } from "./config";
import type { Database, Json } from "@/lib/database/types";

function readBookingIdFromPayload(payload: Json): string | null {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const bookingId = (payload as Record<string, unknown>).bookingId;
  return typeof bookingId === "string" && bookingId.trim() ? bookingId.trim() : null;
}

function readTemplate(payload: Json): string | null {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const template = (payload as Record<string, unknown>).template;
  return typeof template === "string" ? template : null;
}

/**
 * True when another outbox row already delivered payment_confirmed for this booking.
 */
export async function hasSentPaymentConfirmedForBooking(
  client: SupabaseClient<Database>,
  bookingId: string,
  excludeOutboxId?: string,
): Promise<boolean> {
  const { data, error } = await client
    .from("notification_outbox")
    .select("id, payload")
    .eq("status", "sent")
    .eq("channel", "email");

  if (error) {
    throw new Error(error.message);
  }

  for (const row of data ?? []) {
    if (excludeOutboxId && row.id === excludeOutboxId) continue;
    if (readTemplate(row.payload) !== PAYMENT_CONFIRMED_TEMPLATE) continue;
    if (readBookingIdFromPayload(row.payload) === bookingId) return true;
  }

  return false;
}
