import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import type { BookingCommandBackend } from "./bookingCommandBackend";
import {
  executeBookingCommand,
  type BookingCommandRunContext,
} from "./executeBookingCommand";
import { InMemoryBookingCommandBackend } from "./inMemoryBookingCommandBackend";
import { SupabaseBookingCommandBackend } from "./supabaseBookingCommandBackend";
import type { BookingCommand, BookingCommandResult } from "./types";
import { runPostBookingCancellationZohoCreditSync } from "@/features/zoho-sales-sync/server/runPostRefundZohoCreditSync";

export type BookingCommandBackendMode = "memory" | "supabase";

export function resolveBookingCommandBackendMode(): BookingCommandBackendMode {
  const explicit = process.env.BOOKING_COMMAND_BACKEND?.toLowerCase();
  if (explicit === "memory") return "memory";
  if (explicit === "supabase") return "supabase";
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return "supabase";
  return "memory";
}

export function createBookingCommandBackend(
  mode: BookingCommandBackendMode = resolveBookingCommandBackendMode(),
): BookingCommandBackend {
  if (mode === "memory") {
    return new InMemoryBookingCommandBackend();
  }
  const client = createServiceRoleClient();
  if (!client) {
    throw new Error(
      "Supabase booking command backend requires SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL).",
    );
  }
  return new SupabaseBookingCommandBackend(client);
}

/**
 * Runs a booking command using the configured backend (Supabase when service role is set).
 */
export async function runBookingCommand(
  cmd: BookingCommand,
  ctx?: BookingCommandRunContext,
  backend?: BookingCommandBackend,
): Promise<BookingCommandResult> {
  const result = await executeBookingCommand(backend ?? createBookingCommandBackend(), cmd, ctx);

  if (result.ok && cmd.type === "CANCEL_BOOKING") {
    const client = createServiceRoleClient();
    if (client) {
      void runPostBookingCancellationZohoCreditSync(client, { bookingId: cmd.bookingId }).catch(
        () => undefined,
      );
    }
  }

  return result;
}
