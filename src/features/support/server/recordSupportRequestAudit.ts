import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database/types";
import { recordRecurringSeriesAudit } from "@/features/recurring/server/recordRecurringSeriesAudit";
import type { SupportRequestSource } from "./supportNotificationTypes";

export type SupportRequestAuditCommand =
  | "support_request_acknowledged"
  | "support_request_resolved"
  | "support_request_rejected"
  | "recurring_support_request_acknowledged"
  | "recurring_support_request_resolved"
  | "recurring_support_request_rejected";

function auditCommandForSource(
  source: SupportRequestSource,
  nextStatus: "acknowledged" | "resolved" | "rejected",
): SupportRequestAuditCommand {
  if (source === "booking_support") {
    if (nextStatus === "acknowledged") return "support_request_acknowledged";
    if (nextStatus === "resolved") return "support_request_resolved";
    return "support_request_rejected";
  }
  if (nextStatus === "acknowledged") return "recurring_support_request_acknowledged";
  if (nextStatus === "resolved") return "recurring_support_request_resolved";
  return "recurring_support_request_rejected";
}

export async function recordBookingSupportRequestAudit(
  client: SupabaseClient<Database>,
  input: {
    bookingId: string;
    requestId: string;
    source: "booking_support";
    oldStatus: string;
    newStatus: string;
    actorProfileId: string;
    requestType: string;
  },
): Promise<void> {
  const command = auditCommandForSource(
    input.source,
    input.newStatus as "acknowledged" | "resolved" | "rejected",
  );

  const metadata: Json = {
    supportRequest: {
      requestId: input.requestId,
      source: input.source,
      oldStatus: input.oldStatus,
      newStatus: input.newStatus,
      requestType: input.requestType,
    },
  };

  const { error } = await client.from("booking_state_audit").insert({
    booking_id: input.bookingId,
    from_status: null,
    to_status: null,
    command,
    actor_profile_id: input.actorProfileId,
    actor_type: "admin",
    reason: null,
    idempotency_key: `support:${input.requestId}:${input.newStatus}`,
    payload: {},
    metadata,
  });

  if (error) throw new Error(error.message);
}

export async function recordRecurringSupportRequestAudit(
  client: SupabaseClient<Database>,
  input: {
    anchorBookingId: string;
    seriesId: string | null;
    requestId: string;
    oldStatus: string;
    newStatus: string;
    actorProfileId: string;
    requestType: string;
    groupId?: string | null;
  },
): Promise<void> {
  const command = auditCommandForSource(
    "recurring_support",
    input.newStatus as "acknowledged" | "resolved" | "rejected",
  );

  await recordRecurringSeriesAudit(client, {
    anchorBookingId: input.anchorBookingId,
    action: "RECURRING_CUSTOMER_REQUEST",
    seriesId: input.seriesId,
    actorType: "admin",
    actorProfileId: input.actorProfileId,
    metadata: {
      requestId: input.requestId,
      auditCommand: command,
      source: "recurring_support",
      oldStatus: input.oldStatus,
      newStatus: input.newStatus,
      requestType: input.requestType,
      groupId: input.groupId ?? undefined,
    },
  });
}
