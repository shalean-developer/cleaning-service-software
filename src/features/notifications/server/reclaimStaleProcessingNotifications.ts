import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getProcessingStaleMinutes,
  NOTIFICATION_MAX_ATTEMPTS,
} from "./config";
import type { Database } from "@/lib/database/types";

export const RECLAIM_STALE_PROCESSING_LAST_ERROR =
  "Reclaimed stale processing notification";

export type ReclaimStaleProcessingResult = {
  reclaimed: number;
};

/**
 * Resets notification_outbox rows stuck in `processing` (e.g. crash after claim)
 * back to `pending` when `updated_at` is older than the stale threshold.
 * Does not send email. reclaim only.
 */
export async function reclaimStaleProcessingNotifications(
  client: SupabaseClient<Database>,
  options: {
    now?: Date;
    staleMinutes?: number;
  } = {},
): Promise<ReclaimStaleProcessingResult> {
  const now = options.now ?? new Date();
  const staleMinutes = options.staleMinutes ?? getProcessingStaleMinutes();
  const cutoffIso = new Date(now.getTime() - staleMinutes * 60_000).toISOString();
  const nowIso = now.toISOString();

  const { data, error } = await client
    .from("notification_outbox")
    .update({
      status: "pending",
      next_retry_at: nowIso,
      last_error: RECLAIM_STALE_PROCESSING_LAST_ERROR,
      updated_at: nowIso,
    })
    .eq("status", "processing")
    .lt("updated_at", cutoffIso)
    .lt("attempts", NOTIFICATION_MAX_ATTEMPTS)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  return { reclaimed: data?.length ?? 0 };
}
