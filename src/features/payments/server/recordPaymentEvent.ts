import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database/types";

export type RecordPaymentEventInput = {
  paymentId: string | null;
  providerEventId: string;
  eventType: string;
  payload: Record<string, unknown>;
};

export type RecordPaymentEventResult =
  | { outcome: "inserted" }
  | { outcome: "duplicate" };

export async function recordPaymentEvent(
  client: SupabaseClient<Database>,
  input: RecordPaymentEventInput,
): Promise<RecordPaymentEventResult> {
  const { error } = await client.from("payment_events").insert({
    payment_id: input.paymentId,
    provider_event_id: input.providerEventId,
    event_type: input.eventType,
    payload: input.payload as Json,
  });

  if (error?.code === "23505") {
    return { outcome: "duplicate" };
  }
  if (error) {
    throw new Error(error.message);
  }

  return { outcome: "inserted" };
}
