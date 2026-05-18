import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import {
  mergeTeamRequestFulfillmentMetadata,
  parseAdminOperationalLoadSignals,
  readTeamRequestFulfillment,
  type TeamRequestFulfillment,
} from "./adminTeamSupportObservation";
import { resolveServiceSlugFromMetadata } from "./parseBookingDisplay";

export type RecordTeamRequestFulfillmentResult =
  | { ok: true; fulfillment: TeamRequestFulfillment }
  | { ok: false; code: string; message: string; httpStatus: number };

export async function recordAdminTeamRequestFulfillment(
  user: CurrentUser,
  bookingId: string,
  fulfilledCleanerCount: 1 | 2,
): Promise<RecordTeamRequestFulfillmentResult> {
  if (user.role !== "admin") {
    return { ok: false, code: "FORBIDDEN", message: "Admins only.", httpStatus: 403 };
  }

  const client = createServiceRoleClient();
  if (!client) {
    return {
      ok: false,
      code: "AUTH_NOT_CONFIGURED",
      message: "Service role not configured.",
      httpStatus: 503,
    };
  }

  const { data: row, error } = await client
    .from("bookings")
    .select("id, metadata")
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: error.message,
      httpStatus: 500,
    };
  }
  if (!row) {
    return { ok: false, code: "NOT_FOUND", message: "Booking not found.", httpStatus: 404 };
  }

  const serviceSlug = resolveServiceSlugFromMetadata(row.metadata);
  const signals = parseAdminOperationalLoadSignals(row.metadata, serviceSlug);
  if (!signals.isTwoCleanerRequest) {
    return {
      ok: false,
      code: "NOT_TEAM_REQUEST",
      message: "This booking is not a 2-cleaner request.",
      httpStatus: 400,
    };
  }

  const fulfillment: TeamRequestFulfillment = {
    fulfilledCleanerCount,
    recordedAt: new Date().toISOString(),
    recordedByProfileId: user.profileId,
  };

  const metadata = mergeTeamRequestFulfillmentMetadata(row.metadata, fulfillment);

  const { error: updateError } = await client
    .from("bookings")
    .update({ metadata, updated_at: fulfillment.recordedAt })
    .eq("id", bookingId);

  if (updateError) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: updateError.message,
      httpStatus: 500,
    };
  }

  const persisted = readTeamRequestFulfillment(metadata);
  if (!persisted) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: "Failed to persist fulfillment record.",
      httpStatus: 500,
    };
  }

  return { ok: true, fulfillment: persisted };
}
