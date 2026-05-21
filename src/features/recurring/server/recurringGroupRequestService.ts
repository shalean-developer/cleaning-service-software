import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import { resolveActorScope } from "@/lib/auth/resolveActorScope";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BookingSeriesRow, RecurringScheduleGroupRow } from "@/lib/database/types";
import type { RecurringSeriesRequestType } from "@/lib/database/types";
import {
  insertScopedRecurringRequest,
  type CustomerGroupRecurringRequestType,
} from "./recurringSeriesRequestsService";

export type { CustomerGroupRecurringRequestType };
import type { RecurringCommandResult } from "./recurringSeriesCommandService";

const GROUP_TYPES = new Set<CustomerGroupRecurringRequestType>([
  "pause_group",
  "cancel_group",
  "reschedule_group",
  "pause_weekday",
  "cancel_weekday",
  "reschedule_weekday",
]);

const WEEKDAY_TYPES = new Set<CustomerGroupRecurringRequestType>([
  "pause_weekday",
  "cancel_weekday",
  "reschedule_weekday",
]);

const RESCHEDULE_TYPES = new Set<RecurringSeriesRequestType>([
  "reschedule",
  "reschedule_group",
  "reschedule_weekday",
]);

function resolveScopeAndType(
  requestType: CustomerGroupRecurringRequestType,
): {
  scope: "series" | "group";
  storedType: RecurringSeriesRequestType;
} {
  if (requestType.endsWith("_group")) {
    return { scope: "group", storedType: requestType };
  }
  return { scope: "series", storedType: requestType };
}

export function resolveCustomerGroupRequestActionsAllowed(
  status: RecurringScheduleGroupRow["status"],
): {
  canRequestPauseGroup: boolean;
  canRequestCancelGroup: boolean;
  canRequestRescheduleGroup: boolean;
  canRequestPauseWeekday: boolean;
  canRequestCancelWeekday: boolean;
  canRequestRescheduleWeekday: boolean;
} {
  const active = status === "active";
  const paused = status === "paused";
  return {
    canRequestPauseGroup: active,
    canRequestCancelGroup: active || paused,
    canRequestRescheduleGroup: active,
    canRequestPauseWeekday: active,
    canRequestCancelWeekday: active || paused,
    canRequestRescheduleWeekday: active,
  };
}

export async function customerRequestRecurringGroupChange(
  user: CurrentUser,
  groupId: string,
  input: {
    requestType: CustomerGroupRecurringRequestType;
    note?: string;
    targetWeekday?: number;
    targetSeriesId?: string;
    requestedDateTimeIso?: string;
  },
): Promise<RecurringCommandResult> {
  if (!GROUP_TYPES.has(input.requestType)) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: "Invalid requestType.",
      httpStatus: 400,
    };
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: "Database unavailable.",
      httpStatus: 500,
    };
  }

  const ctx = await resolveActorScope(client, user.profileId, user.role);
  if (!ctx.actingCustomerId) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "Customer profile not ready.",
      httpStatus: 403,
    };
  }

  const { data: groupRow, error: groupError } = await client
    .from("recurring_schedule_groups")
    .select("*")
    .eq("id", groupId)
    .maybeSingle();
  if (groupError) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: groupError.message,
      httpStatus: 500,
    };
  }
  if (!groupRow) {
    return { ok: false, code: "NOT_FOUND", message: "Schedule group not found.", httpStatus: 404 };
  }

  const group = groupRow as RecurringScheduleGroupRow;
  if (group.customer_id !== ctx.actingCustomerId) {
    return { ok: false, code: "FORBIDDEN", message: "Not your schedule.", httpStatus: 403 };
  }

  const { data: seriesRows, error: seriesError } = await client
    .from("booking_series")
    .select("*")
    .eq("group_id", groupId);
  if (seriesError) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: seriesError.message,
      httpStatus: 500,
    };
  }

  const seriesList = (seriesRows ?? []) as BookingSeriesRow[];
  const { scope, storedType } = resolveScopeAndType(input.requestType);

  let seriesId: string | null = null;
  let targetWeekday: number | null = null;

  if (WEEKDAY_TYPES.has(input.requestType)) {
    if (input.targetWeekday == null && !input.targetSeriesId?.trim()) {
      return {
        ok: false,
        code: "INVALID_PAYLOAD",
        message: "targetWeekday or targetSeriesId is required for weekday requests.",
        httpStatus: 400,
      };
    }
    const series =
      input.targetSeriesId?.trim()
        ? seriesList.find((s) => s.id === input.targetSeriesId!.trim())
        : seriesList.find((s) => s.weekday === input.targetWeekday);
    if (!series) {
      return {
        ok: false,
        code: "INVALID_PAYLOAD",
        message: "Weekday series not found in this group.",
        httpStatus: 400,
      };
    }
    seriesId = series.id;
    targetWeekday = series.weekday ?? input.targetWeekday ?? null;
    if (
      targetWeekday != null &&
      !group.selected_days.includes(targetWeekday)
    ) {
      return {
        ok: false,
        code: "INVALID_PAYLOAD",
        message: "targetWeekday is not part of this schedule.",
        httpStatus: 400,
      };
    }
  }

  if (RESCHEDULE_TYPES.has(storedType) && !input.requestedDateTimeIso?.trim()) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: "requestedDateTimeIso is required for reschedule requests.",
      httpStatus: 400,
    };
  }

  const metadata: Record<string, unknown> = {};
  if (input.requestedDateTimeIso?.trim()) {
    metadata.requestedDateTimeIso = input.requestedDateTimeIso.trim();
  }

  const inserted = await insertScopedRecurringRequest(client, {
    scope,
    seriesId,
    groupId: group.id,
    targetWeekday,
    customerId: group.customer_id,
    requestType: storedType,
    note: input.note,
    anchorBookingId: group.anchor_booking_id,
    actorProfileId: user.profileId,
    metadata,
  });

  if (!inserted.ok) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: inserted.message,
      httpStatus: 500,
    };
  }

  return {
    ok: true,
    message:
      "Request received. Our team will review your schedule change and confirm before anything is updated.",
  };
}
