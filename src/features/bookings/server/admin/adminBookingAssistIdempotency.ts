import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database/types";

export type AdminBookingDraftIdempotencyResult = {
  bookingId: string;
  status: "draft";
  priceCents: number;
  currency: string;
  idempotent: boolean;
};

export async function findAdminBookingAssistIdempotency(
  client: SupabaseClient<Database>,
  idempotencyKey: string,
): Promise<AdminBookingDraftIdempotencyResult | null> {
  const { data, error } = await client
    .from("admin_booking_assist_idempotency")
    .select("result")
    .eq("idempotency_key", idempotencyKey.trim())
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.result || typeof data.result !== "object" || Array.isArray(data.result)) {
    return null;
  }

  const row = data.result as Record<string, unknown>;
  if (
    typeof row.bookingId !== "string" ||
    row.status !== "draft" ||
    typeof row.priceCents !== "number" ||
    typeof row.currency !== "string"
  ) {
    return null;
  }

  return {
    bookingId: row.bookingId,
    status: "draft",
    priceCents: row.priceCents,
    currency: row.currency,
    idempotent: true,
  };
}

export async function storeAdminBookingAssistIdempotency(
  client: SupabaseClient<Database>,
  input: {
    idempotencyKey: string;
    adminProfileId: string;
    customerId: string;
    result: AdminBookingDraftIdempotencyResult;
  },
): Promise<void> {
  const { error } = await client.from("admin_booking_assist_idempotency").insert({
    idempotency_key: input.idempotencyKey.trim(),
    admin_profile_id: input.adminProfileId,
    customer_id: input.customerId,
    result: {
      bookingId: input.result.bookingId,
      status: input.result.status,
      priceCents: input.result.priceCents,
      currency: input.result.currency,
      idempotent: input.result.idempotent,
    } satisfies Json,
  });

  if (error?.code === "23505") {
    return;
  }
  if (error) {
    throw new Error(error.message);
  }
}
