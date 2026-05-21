import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import { SupabaseBookingCommandBackend } from "@/features/bookings/server/commands/supabaseBookingCommandBackend";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findScheduleGroupById } from "../recurringScheduleGroupRepository";
import {
  cancelRecurringScheduleGroup,
  pauseRecurringScheduleGroup,
  resumeRecurringScheduleGroup,
} from "../scheduleGroupActions";
import { generateRecurringOccurrencesForSeries } from "../generateRecurringOccurrences";
import { recordRecurringSeriesAudit } from "./recordRecurringSeriesAudit";
import type { RecurringCommandResult } from "./recurringSeriesCommandService";

async function loadGroupForAdmin(groupId: string) {
  const client = await createSupabaseServerClient();
  if (!client) {
    return {
      ok: false as const,
      result: {
        ok: false,
        code: "PERSISTENCE_ERROR",
        message: "Database unavailable.",
        httpStatus: 500,
      } satisfies RecurringCommandResult,
    };
  }
  const group = await findScheduleGroupById(client, groupId);
  if (!group) {
    return {
      ok: false as const,
      result: {
        ok: false,
        code: "NOT_FOUND",
        message: "Schedule group not found.",
        httpStatus: 404,
      } satisfies RecurringCommandResult,
    };
  }
  return { ok: true as const, client, group };
}

export async function adminPauseRecurringScheduleGroup(
  user: CurrentUser,
  groupId: string,
): Promise<RecurringCommandResult> {
  const loaded = await loadGroupForAdmin(groupId);
  if (!loaded.ok) return loaded.result;
  const { client, group } = loaded;

  if (group.status === "paused") {
    return { ok: true, message: "Schedule group already paused.", idempotent: true };
  }
  if (group.status === "cancelled") {
    return {
      ok: false,
      code: "INVALID_STATE",
      message: "Cancelled schedule groups cannot be paused.",
      httpStatus: 409,
    };
  }

  await pauseRecurringScheduleGroup(client, groupId);
  await recordRecurringSeriesAudit(client, {
    anchorBookingId: group.anchor_booking_id,
    action: "RECURRING_SCHEDULE_GROUP_PAUSE",
    seriesId: null,
    actorType: "admin",
    actorProfileId: user.profileId,
    metadata: { groupId },
  });

  return { ok: true, message: "Schedule group paused." };
}

export async function adminResumeRecurringScheduleGroup(
  user: CurrentUser,
  groupId: string,
): Promise<RecurringCommandResult> {
  const loaded = await loadGroupForAdmin(groupId);
  if (!loaded.ok) return loaded.result;
  const { client, group } = loaded;

  if (group.status === "active") {
    return { ok: true, message: "Schedule group already active.", idempotent: true };
  }
  if (group.status === "cancelled") {
    return {
      ok: false,
      code: "INVALID_STATE",
      message: "Cancelled schedule groups cannot be resumed.",
      httpStatus: 409,
    };
  }

  const { data: pausedSeries, error: seriesError } = await client
    .from("booking_series")
    .select("id")
    .eq("group_id", groupId)
    .eq("status", "paused");
  if (seriesError) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: seriesError.message,
      httpStatus: 500,
    };
  }

  await resumeRecurringScheduleGroup(client, groupId);

  const backend = new SupabaseBookingCommandBackend(client);
  for (const row of pausedSeries ?? []) {
    await generateRecurringOccurrencesForSeries(client, backend, row.id as string);
  }

  await recordRecurringSeriesAudit(client, {
    anchorBookingId: group.anchor_booking_id,
    action: "RECURRING_SCHEDULE_GROUP_RESUME",
    seriesId: null,
    actorType: "admin",
    actorProfileId: user.profileId,
    metadata: { groupId, resumedSeriesCount: (pausedSeries ?? []).length },
  });

  return { ok: true, message: "Schedule group resumed." };
}

export async function adminCancelRecurringScheduleGroup(
  user: CurrentUser,
  groupId: string,
): Promise<RecurringCommandResult> {
  const loaded = await loadGroupForAdmin(groupId);
  if (!loaded.ok) return loaded.result;
  const { client, group } = loaded;

  if (group.status === "cancelled") {
    return { ok: true, message: "Schedule group already cancelled.", idempotent: true };
  }

  const backend = new SupabaseBookingCommandBackend(client);
  const { cancelledBookings } = await cancelRecurringScheduleGroup(client, backend, groupId, {
    actorType: "admin",
    profileId: user.profileId,
  });

  await recordRecurringSeriesAudit(client, {
    anchorBookingId: group.anchor_booking_id,
    action: "RECURRING_SCHEDULE_GROUP_CANCEL",
    seriesId: null,
    actorType: "admin",
    actorProfileId: user.profileId,
    metadata: { groupId, cancelledBookings },
  });

  return {
    ok: true,
    message: `Schedule group cancelled. ${cancelledBookings} unpaid visit(s) removed.`,
  };
}
