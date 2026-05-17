import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import {
  backfillNotificationMetricsHourly,
  isNotificationMetricsRollupEnabled,
} from "@/features/notifications/server/rollupNotificationMetricsHourly";
import { NOTIFICATION_METRICS_MAX_BACKFILL_HOURS } from "@/features/notifications/server/notificationMetricsHourlyUtc";

export async function runBackfillNotificationMetricsHourlyCli(options?: {
  hours?: number;
}): Promise<number> {
  if (!isNotificationMetricsRollupEnabled()) {
    console.error("NOTIFICATION_METRICS_ROLLUP_ENABLED is false — aborting.");
    return 1;
  }

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    return 1;
  }

  const hours = Math.min(
    Math.max(1, options?.hours ?? NOTIFICATION_METRICS_MAX_BACKFILL_HOURS),
    NOTIFICATION_METRICS_MAX_BACKFILL_HOURS,
  );

  const client = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(
    JSON.stringify({
      event: "notification_metrics_backfill_start",
      hours,
    }),
  );

  const result = await backfillNotificationMetricsHourly(client, {
    hours,
    onProgress: ({ completed, total, hoursProcessed, hoursFailed }) => {
      if (completed % 24 === 0 || completed === total) {
        console.log(
          JSON.stringify({
            event: "notification_metrics_backfill_progress",
            completed,
            total,
            hoursProcessed,
            hoursFailed,
          }),
        );
      }
    },
  });

  console.log(
    JSON.stringify({
      event: "notification_metrics_backfill_complete",
      hoursRequested: result.hoursRequested,
      hoursProcessed: result.hoursProcessed,
      hoursFailed: result.hoursFailed,
    }),
  );

  return result.hoursFailed > 0 ? 1 : 0;
}
