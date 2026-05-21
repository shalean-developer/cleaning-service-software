import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database/types";

export type RecurringSeriesAuditAction =
  | "RECURRING_SERIES_PAUSE"
  | "RECURRING_SERIES_RESUME"
  | "RECURRING_SERIES_CANCEL"
  | "RECURRING_SERIES_SKIP_NEXT"
  | "RECURRING_SERIES_RESCHEDULE_NEXT"
  | "RECURRING_CUSTOMER_REQUEST";

export async function recordRecurringSeriesAudit(
  client: SupabaseClient<Database>,
  input: {
    anchorBookingId: string;
    action: RecurringSeriesAuditAction;
    seriesId: string;
    actorType: "admin" | "customer";
    actorProfileId: string | null;
    metadata?: Record<string, unknown>;
    reason?: string | null;
  },
): Promise<void> {
  const metadata: Json = {
    recurringSeries: {
      seriesId: input.seriesId,
      action: input.action,
      ...(input.metadata ?? {}),
    },
  };

  const { error } = await client.from("booking_state_audit").insert({
    booking_id: input.anchorBookingId,
    from_status: null,
    to_status: null,
    command: input.action,
    actor_profile_id: input.actorProfileId,
    actor_type: input.actorType,
    reason: input.reason ?? null,
    idempotency_key: null,
    payload: {},
    metadata,
  });

  if (error) throw new Error(error.message);
}
