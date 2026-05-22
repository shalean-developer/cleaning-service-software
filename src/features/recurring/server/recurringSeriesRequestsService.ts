import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import type { Database } from "@/lib/database/types";
import type {
  RecurringSeriesRequestRow,
  RecurringSeriesRequestScope,
  RecurringSeriesRequestType,
} from "@/lib/database/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RECURRING_WEEKDAY_FULL_LABELS } from "../recurringScheduleDays";
import { recordRecurringSeriesAudit } from "./recordRecurringSeriesAudit";
import type {
  RecurringSeriesRequestScope as ScopeLabel,
  RecurringSeriesRequestType as UiRequestType,
} from "./recurringManagementTypes";

export type RecurringSeriesRequestStatus =
  | "open"
  | "acknowledged"
  | "resolved"
  | "rejected";

export type RecurringSeriesRequestSummary = {
  id: string;
  seriesId: string | null;
  groupId: string | null;
  customerId: string;
  scope: RecurringSeriesRequestScope;
  requestType: RecurringSeriesRequestType;
  requestTypeLabel: string;
  scopeLabel: string;
  status: RecurringSeriesRequestStatus;
  statusLabel: string;
  note: string | null;
  createdAt: string;
  resolvedAt: string | null;
  targetWeekday: number | null;
  targetWeekdayLabel: string | null;
  requestedDateTimeIso: string | null;
};

const REQUEST_TYPE_LABELS: Record<RecurringSeriesRequestType, string> = {
  pause: "Pause",
  cancel: "Cancel",
  reschedule: "Reschedule",
  pause_group: "Pause entire schedule",
  cancel_group: "Cancel entire schedule",
  reschedule_group: "Reschedule entire schedule",
  pause_weekday: "Pause weekday",
  cancel_weekday: "Cancel weekday",
  reschedule_weekday: "Reschedule weekday",
};

const SCOPE_LABELS: Record<RecurringSeriesRequestScope, string> = {
  series: "Weekday",
  group: "Full schedule",
};

const STATUS_LABELS: Record<RecurringSeriesRequestStatus, string> = {
  open: "Open",
  acknowledged: "Acknowledged",
  resolved: "Resolved",
  rejected: "Rejected",
};

function weekdayLabel(weekday: number | null): string | null {
  if (weekday == null || weekday < 0 || weekday > 6) return null;
  return RECURRING_WEEKDAY_FULL_LABELS[weekday] ?? String(weekday);
}

function readRequestedDateTime(metadata: Record<string, unknown>): string | null {
  const v = metadata.requestedDateTimeIso;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function mapRow(row: RecurringSeriesRequestRow): RecurringSeriesRequestSummary {
  const meta =
    row.metadata != null && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
  return {
    id: row.id,
    seriesId: row.series_id,
    groupId: row.group_id,
    customerId: row.customer_id,
    scope: row.scope,
    requestType: row.request_type,
    requestTypeLabel: REQUEST_TYPE_LABELS[row.request_type],
    scopeLabel: SCOPE_LABELS[row.scope],
    status: row.status,
    statusLabel: STATUS_LABELS[row.status],
    note: row.note,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    targetWeekday: row.target_weekday,
    targetWeekdayLabel: weekdayLabel(row.target_weekday),
    requestedDateTimeIso: readRequestedDateTime(meta),
  };
}

export type LegacyCustomerRecurringRequestType = "pause" | "cancel" | "reschedule";

export async function insertRecurringSeriesRequest(
  client: SupabaseClient<Database>,
  input: {
    seriesId: string;
    customerId: string;
    requestType: LegacyCustomerRecurringRequestType;
    note?: string | null;
    anchorBookingId: string;
    actorProfileId: string;
  },
): Promise<{ ok: true; requestId: string } | { ok: false; message: string }> {
  return insertScopedRecurringRequest(client, {
    scope: "series",
    seriesId: input.seriesId,
    groupId: null,
    targetWeekday: null,
    customerId: input.customerId,
    requestType: input.requestType,
    note: input.note,
    anchorBookingId: input.anchorBookingId,
    actorProfileId: input.actorProfileId,
    metadata: {},
  });
}

export async function insertScopedRecurringRequest(
  client: SupabaseClient<Database>,
  input: {
    scope: RecurringSeriesRequestScope;
    seriesId: string | null;
    groupId: string | null;
    targetWeekday: number | null;
    customerId: string;
    requestType: RecurringSeriesRequestType;
    note?: string | null;
    anchorBookingId: string;
    actorProfileId: string;
    metadata?: Record<string, unknown>;
  },
): Promise<{ ok: true; requestId: string } | { ok: false; message: string }> {
  const metadata = { ...(input.metadata ?? {}) };

  const { data, error } = await client
    .from("recurring_series_requests")
    .insert({
      series_id: input.seriesId,
      group_id: input.groupId,
      scope: input.scope,
      target_weekday: input.targetWeekday,
      customer_id: input.customerId,
      request_type: input.requestType,
      note: input.note?.trim() || null,
      status: "open",
      metadata,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, message: error.message };
  }

  await recordRecurringSeriesAudit(client, {
    anchorBookingId: input.anchorBookingId,
    action: "RECURRING_CUSTOMER_REQUEST",
    seriesId: input.seriesId,
    actorType: "customer",
    actorProfileId: input.actorProfileId,
    reason: input.note?.trim() || null,
    metadata: {
      requestType: input.requestType,
      requestId: data.id as string,
      scope: input.scope,
      groupId: input.groupId ?? undefined,
      targetWeekday: input.targetWeekday ?? undefined,
      ...metadata,
    },
  });

  return { ok: true, requestId: data.id as string };
}

export async function countOpenRecurringSeriesRequests(
  client: SupabaseClient<Database>,
): Promise<number> {
  const { count, error } = await client
    .from("recurring_series_requests")
    .select("id", { count: "exact", head: true })
    .in("status", ["open", "acknowledged"]);
  if (error) return 0;
  return count ?? 0;
}

async function fetchRequestsForSeriesOrGroup(
  client: SupabaseClient<Database>,
  input: { seriesIds: string[]; groupId: string | null },
): Promise<RecurringSeriesRequestRow[]> {
  const filters: string[] = [];
  if (input.seriesIds.length > 0) {
    filters.push(`series_id.in.(${input.seriesIds.join(",")})`);
  }
  if (input.groupId) {
    filters.push(`group_id.eq.${input.groupId}`);
  }
  if (filters.length === 0) return [];

  const { data, error } = await client
    .from("recurring_series_requests")
    .select("*")
    .or(filters.join(","))
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as RecurringSeriesRequestRow[];
}

export async function loadOpenRequestsBySeriesIds(
  client: SupabaseClient<Database>,
  seriesIds: string[],
): Promise<Map<string, RecurringSeriesRequestSummary>> {
  const map = new Map<string, RecurringSeriesRequestSummary>();
  if (seriesIds.length === 0) return map;

  const rows = await fetchRequestsForSeriesOrGroup(client, { seriesIds, groupId: null });
  for (const row of rows) {
    if (row.status !== "open" && row.status !== "acknowledged") continue;
    const key = row.series_id ?? (row.group_id ? `group:${row.group_id}` : null);
    if (!key || map.has(key)) continue;
    map.set(key, mapRow(row));
  }
  return map;
}

export async function loadOpenRequestsForGroup(
  client: SupabaseClient<Database>,
  input: { groupId: string; seriesIds: string[] },
): Promise<RecurringSeriesRequestSummary[]> {
  const rows = await fetchRequestsForSeriesOrGroup(client, {
    seriesIds: input.seriesIds,
    groupId: input.groupId,
  });
  return rows
    .filter((r) => r.status === "open" || r.status === "acknowledged")
    .map(mapRow);
}

export async function loadLatestRequestsBySeriesIds(
  client: SupabaseClient<Database>,
  seriesIds: string[],
): Promise<Map<string, RecurringSeriesRequestSummary>> {
  const map = new Map<string, RecurringSeriesRequestSummary>();
  if (seriesIds.length === 0) return map;

  const rows = await fetchRequestsForSeriesOrGroup(client, { seriesIds, groupId: null });
  for (const row of rows) {
    if (!row.series_id || map.has(row.series_id)) continue;
    map.set(row.series_id, mapRow(row));
  }
  return map;
}

export async function loadAllRequestsForSeriesIds(
  client: SupabaseClient<Database>,
  seriesIds: string[],
): Promise<RecurringSeriesRequestSummary[]> {
  if (seriesIds.length === 0) return [];
  const rows = await fetchRequestsForSeriesOrGroup(client, { seriesIds, groupId: null });
  return rows.map(mapRow);
}

export async function loadAllRequestsForGroup(
  client: SupabaseClient<Database>,
  input: { groupId: string; seriesIds: string[] },
): Promise<RecurringSeriesRequestSummary[]> {
  const rows = await fetchRequestsForSeriesOrGroup(client, input);
  const seen = new Set<string>();
  const out: RecurringSeriesRequestSummary[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(mapRow(row));
  }
  return out;
}

export async function loadLatestRequestForSeries(
  client: SupabaseClient<Database>,
  seriesId: string,
): Promise<RecurringSeriesRequestSummary | null> {
  const { data, error } = await client
    .from("recurring_series_requests")
    .select("*")
    .eq("series_id", seriesId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return mapRow(data as RecurringSeriesRequestRow);
}

export async function adminResolveRecurringSeriesRequest(
  user: CurrentUser,
  requestId: string,
  options: { acknowledgeOnly?: boolean; reject?: boolean } = {},
): Promise<
  | { ok: true; message: string }
  | { ok: false; code: string; message: string; httpStatus: number }
> {
  if (user.role !== "admin") {
    return { ok: false, code: "FORBIDDEN", message: "Admin only.", httpStatus: 403 };
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

  const { data: row, error: fetchError } = await client
    .from("recurring_series_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (fetchError) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: fetchError.message,
      httpStatus: 500,
    };
  }
  if (!row) {
    return { ok: false, code: "NOT_FOUND", message: "Request not found.", httpStatus: 404 };
  }

  const request = row as RecurringSeriesRequestRow;
  if (options.acknowledgeOnly && options.reject) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: "Cannot acknowledge and reject in one action.",
      httpStatus: 400,
    };
  }

  let nextStatus: RecurringSeriesRequestStatus;
  if (options.reject) {
    nextStatus = "rejected";
  } else if (options.acknowledgeOnly) {
    nextStatus = "acknowledged";
  } else {
    nextStatus = "resolved";
  }

  if (request.status === nextStatus) {
    return {
      ok: true,
      message: `Request already ${STATUS_LABELS[nextStatus].toLowerCase()}.`,
    };
  }

  if (
    (request.status === "resolved" || request.status === "rejected") &&
    nextStatus !== request.status
  ) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: "Closed requests cannot be reopened from the inbox.",
      httpStatus: 400,
    };
  }

  const patch: Record<string, unknown> = { status: nextStatus };
  if (nextStatus === "resolved" || nextStatus === "rejected") {
    patch.resolved_at = new Date().toISOString();
    patch.resolved_by = user.profileId;
  }

  const { error: updateError } = await client
    .from("recurring_series_requests")
    .update(patch)
    .eq("id", requestId);

  if (updateError) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: updateError.message,
      httpStatus: 500,
    };
  }

  let anchorBookingId: string | null = null;
  if (request.series_id) {
    const { data: series } = await client
      .from("booking_series")
      .select("created_from_booking_id")
      .eq("id", request.series_id)
      .maybeSingle();
    anchorBookingId = (series?.created_from_booking_id as string) ?? null;
  } else if (request.group_id) {
    const { data: group } = await client
      .from("recurring_schedule_groups")
      .select("anchor_booking_id")
      .eq("id", request.group_id)
      .maybeSingle();
    anchorBookingId = (group?.anchor_booking_id as string) ?? null;
  }

  if (anchorBookingId) {
    await recordRecurringSeriesAudit(client, {
      anchorBookingId,
      action: "RECURRING_CUSTOMER_REQUEST",
      seriesId: request.series_id,
      actorType: "admin",
      actorProfileId: user.profileId,
      metadata: {
        requestId,
        requestResolution: nextStatus,
        requestType: request.request_type,
        scope: request.scope,
        groupId: request.group_id ?? undefined,
      },
    });
  }

  const messages: Record<RecurringSeriesRequestStatus, string> = {
    open: "Request marked open.",
    acknowledged: "Request marked acknowledged.",
    resolved: "Request marked resolved.",
    rejected: "Request marked rejected.",
  };

  return { ok: true, message: messages[nextStatus] };
}

/** @deprecated Use RecurringSeriesRequestType from recurringManagementTypes */
export type CustomerRecurringRequestType = LegacyCustomerRecurringRequestType;

export type CustomerGroupRecurringRequestType = Extract<
  UiRequestType,
  | "pause_group"
  | "cancel_group"
  | "reschedule_group"
  | "pause_weekday"
  | "cancel_weekday"
  | "reschedule_weekday"
>;
