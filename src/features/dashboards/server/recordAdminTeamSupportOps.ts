import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import {
  mergeTeamSupportOpsMetadata,
  parseAdminOperationalLoadSignals,
  readTeamSupportOps,
  type SupportingCleanerRecord,
  type TeamCoordinationStatus,
  type TeamCoordinationStatusRecord,
  type TeamSupportOps,
} from "./adminTeamSupportObservation";
import { resolveServiceSlugFromMetadata } from "./parseBookingDisplay";

export type RecordTeamSupportOpsInput = {
  supportingCleaner?: { name?: string; profileId?: string } | null;
  teamSupportNotes?: string | null;
  coordinationStatus?: TeamCoordinationStatus | null;
};

export type RecordTeamSupportOpsResult =
  | { ok: true; teamSupportOps: TeamSupportOps }
  | { ok: false; code: string; message: string; httpStatus: number };

function trimOptional(value: string | undefined): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function recordAdminTeamSupportOps(
  user: CurrentUser,
  bookingId: string,
  input: RecordTeamSupportOpsInput,
): Promise<RecordTeamSupportOpsResult> {
  if (user.role !== "admin") {
    return { ok: false, code: "FORBIDDEN", message: "Admins only.", httpStatus: 403 };
  }

  const hasPatch =
    "supportingCleaner" in input ||
    "teamSupportNotes" in input ||
    "coordinationStatus" in input;
  if (!hasPatch) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: "No team support ops fields to update.",
      httpStatus: 400,
    };
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
      message: "This booking does not have a team support request.",
      httpStatus: 400,
    };
  }

  const recordedAt = new Date().toISOString();
  const patch: Parameters<typeof mergeTeamSupportOpsMetadata>[1] = {};

  if ("supportingCleaner" in input) {
    if (input.supportingCleaner == null) {
      patch.supportingCleaner = null;
    } else {
      const name = trimOptional(input.supportingCleaner.name);
      const profileId = trimOptional(input.supportingCleaner.profileId);
      if (!name && !profileId) {
        return {
          ok: false,
          code: "INVALID_PAYLOAD",
          message: "Provide supporting cleaner name and/or profile id.",
          httpStatus: 400,
        };
      }
      const record: SupportingCleanerRecord = {
        recordedAt,
        recordedByProfileId: user.profileId,
        ...(name ? { name } : {}),
        ...(profileId ? { profileId } : {}),
      };
      patch.supportingCleaner = record;
    }
  }

  if ("teamSupportNotes" in input) {
    patch.teamSupportNotes = input.teamSupportNotes;
  }

  if ("coordinationStatus" in input) {
    if (input.coordinationStatus == null) {
      patch.coordinationStatus = null;
    } else {
      const status = input.coordinationStatus;
      if (
        status !== "awaiting_coordination" &&
        status !== "partially_fulfilled" &&
        status !== "fully_coordinated"
      ) {
        return {
          ok: false,
          code: "INVALID_PAYLOAD",
          message: "Invalid coordinationStatus.",
          httpStatus: 400,
        };
      }
      const record: TeamCoordinationStatusRecord = {
        status,
        recordedAt,
        recordedByProfileId: user.profileId,
      };
      patch.coordinationStatus = record;
    }
  }

  const metadata = mergeTeamSupportOpsMetadata(row.metadata, patch);

  const { error: updateError } = await client
    .from("bookings")
    .update({ metadata, updated_at: recordedAt })
    .eq("id", bookingId);

  if (updateError) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: updateError.message,
      httpStatus: 500,
    };
  }

  return { ok: true, teamSupportOps: readTeamSupportOps(metadata) };
}
