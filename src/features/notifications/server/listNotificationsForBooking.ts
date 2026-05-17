import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import type { AdminNotificationOutboxEntry } from "@/features/dashboards/server/types";
import {
  ADMIN_BOOKING_NOTIFICATION_LIMIT,
  mapNotificationOutboxRowForAdmin,
} from "./mapNotificationOutboxRowForAdmin";

/**
 * Read-only notification history for one booking (admin observability).
 */
export async function listNotificationsForBooking(
  client: SupabaseClient<Database>,
  bookingId: string,
): Promise<AdminNotificationOutboxEntry[]> {
  const { data, error } = await client
    .from("notification_outbox")
    .select(
      "id, channel, recipient, payload, status, attempts, next_retry_at, last_error, created_at, updated_at",
    )
    .eq("payload->>bookingId", bookingId)
    .order("created_at", { ascending: false })
    .limit(ADMIN_BOOKING_NOTIFICATION_LIMIT);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) =>
    mapNotificationOutboxRowForAdmin(row, { requeueActionsEnabled: true }),
  );
}
