import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CleanerAvailabilityWindow } from "@/features/cleaners/admin/cleanerAvailability";
import type { Database } from "@/lib/database/types";

export async function replaceCleanerAvailability(
  client: SupabaseClient<Database>,
  cleanerId: string,
  windows: CleanerAvailabilityWindow[],
): Promise<void> {
  const { error: deleteError } = await client
    .from("cleaner_availability")
    .delete()
    .eq("cleaner_id", cleanerId);
  if (deleteError) throw new Error(deleteError.message);

  if (windows.length === 0) return;

  const { error: insertError } = await client.from("cleaner_availability").insert(
    windows.map((window) => ({
      cleaner_id: cleanerId,
      day_of_week: window.dayOfWeek,
      start_time: window.startTime,
      end_time: window.endTime,
      timezone: window.timezone,
    })),
  );
  if (insertError) throw new Error(insertError.message);
}
