import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";

/**
 * Sets `app.cleaner_lifecycle_column_write = 1` for the current transaction (Phase C bypass).
 */
export async function enableCleanerLifecycleColumnWrite(
  client: SupabaseClient<Database>,
): Promise<void> {
  const { error } = await client.rpc("enable_cleaner_lifecycle_column_write" as never);
  if (error) {
    throw new Error(
      `enable_cleaner_lifecycle_column_write failed: ${error.message}. Apply migration 20260601120000_cleaner_lifecycle_service_commands_phase_e.sql.`,
    );
  }
}
