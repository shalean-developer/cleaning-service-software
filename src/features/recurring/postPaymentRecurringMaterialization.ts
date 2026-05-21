import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingCommandBackend } from "@/features/bookings/server/commands/bookingCommandBackend";
import type { BookingRow, Database } from "@/lib/database/types";
import { generateRecurringOccurrencesForSeries } from "./generateRecurringOccurrences";
import { materializeRecurringSeriesFromBooking } from "./materializeRecurringSeriesFromBooking";

/**
 * Runs after payment finalization (alongside assignment dispatch).
 * Does not modify finalizePaidBooking — extends the post-payment hook path only.
 */
export async function runPostPaymentRecurringMaterialization(
  client: SupabaseClient<Database>,
  backend: BookingCommandBackend,
  booking: BookingRow,
): Promise<void> {
  try {
    const materialized = await materializeRecurringSeriesFromBooking(client, booking);
    if (!materialized.ok || !materialized.materialized || !("seriesId" in materialized)) {
      return;
    }
    await generateRecurringOccurrencesForSeries(client, backend, materialized.seriesId);
  } catch {
    // Payment and assignment remain finalized; recurring is best-effort here.
  }
}
