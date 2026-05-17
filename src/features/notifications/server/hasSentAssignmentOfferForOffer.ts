import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { ASSIGNMENT_OFFER_TEMPLATE } from "./config";
import type { Database, Json } from "@/lib/database/types";

function readOfferIdFromPayload(payload: Json): string | null {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const offerId = (payload as Record<string, unknown>).offerId;
  return typeof offerId === "string" && offerId.trim() ? offerId.trim() : null;
}

function readTemplate(payload: Json): string | null {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const template = (payload as Record<string, unknown>).template;
  return typeof template === "string" ? template : null;
}

/**
 * True when another outbox row already delivered assignment_offer for this offerId.
 */
export async function hasSentAssignmentOfferForOffer(
  client: SupabaseClient<Database>,
  offerId: string,
  excludeOutboxId?: string,
): Promise<boolean> {
  const { data, error } = await client
    .from("notification_outbox")
    .select("id, payload")
    .eq("status", "sent");

  if (error) {
    throw new Error(error.message);
  }

  for (const row of data ?? []) {
    if (excludeOutboxId && row.id === excludeOutboxId) continue;
    if (readTemplate(row.payload) !== ASSIGNMENT_OFFER_TEMPLATE) continue;
    if (readOfferIdFromPayload(row.payload) === offerId) return true;
  }

  return false;
}
