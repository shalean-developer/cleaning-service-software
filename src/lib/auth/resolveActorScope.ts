import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import type { BookingCommandRunContext } from "@/features/bookings/server/commands/executeBookingCommand";
import type { UserRole } from "@/lib/database/types";

/**
 * Resolves customers.id and cleaners.id for the authenticated profile.
 * Used to populate {@link BookingCommandRunContext} before executeBookingCommand.
 */
export async function resolveActorScope(
  client: SupabaseClient<Database>,
  profileId: string,
  role: UserRole,
): Promise<BookingCommandRunContext> {
  const ctx: BookingCommandRunContext = {};

  if (role === "customer") {
    const { data, error } = await client
      .from("customers")
      .select("id")
      .eq("profile_id", profileId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    ctx.actingCustomerId = data?.id ?? null;
  }

  if (role === "cleaner") {
    const { data, error } = await client
      .from("cleaners")
      .select("id")
      .eq("profile_id", profileId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    ctx.actingCleanerId = data?.id ?? null;
  }

  return ctx;
}
