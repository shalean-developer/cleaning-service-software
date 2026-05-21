import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import type { Database } from "@/lib/database/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordRecurringSeriesAudit } from "./recordRecurringSeriesAudit";
import type { CustomerRecurringRequestType } from "./recurringSeriesCommandService";

export type RecurringSeriesRequestStatus = "open" | "acknowledged" | "resolved";

export type RecurringSeriesRequestRow = {
  id: string;
  series_id: string;
  customer_id: string;
  request_type: CustomerRecurringRequestType;
  note: string | null;
  status: RecurringSeriesRequestStatus;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  metadata: Record<string, unknown>;
};

export type RecurringSeriesRequestSummary = {
  id: string;
  seriesId: string;
  customerId: string;
  requestType: CustomerRecurringRequestType;
  requestTypeLabel: string;
  status: RecurringSeriesRequestStatus;
  statusLabel: string;
  note: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

const REQUEST_TYPE_LABELS: Record<CustomerRecurringRequestType, string> = {
  pause: "Pause",
  cancel: "Cancel",
  reschedule: "Reschedule",
};

const STATUS_LABELS: Record<RecurringSeriesRequestStatus, string> = {
  open: "Open",
  acknowledged: "Acknowledged",
  resolved: "Resolved",
};

function mapRow(row: RecurringSeriesRequestRow): RecurringSeriesRequestSummary {
  return {
    id: row.id,
    seriesId: row.series_id,
    customerId: row.customer_id,
    requestType: row.request_type,
    requestTypeLabel: REQUEST_TYPE_LABELS[row.request_type],
    status: row.status,
    statusLabel: STATUS_LABELS[row.status],
    note: row.note,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

export async function insertRecurringSeriesRequest(
  client: SupabaseClient<Database>,
  input: {
    seriesId: string;
    customerId: string;
    requestType: CustomerRecurringRequestType;
    note?: string | null;
    anchorBookingId: string;
    actorProfileId: string;
  },
): Promise<{ ok: true; requestId: string } | { ok: false; message: string }> {
  const { data, error } = await client
    .from("recurring_series_requests")
    .insert({
      series_id: input.seriesId,
      customer_id: input.customerId,
      request_type: input.requestType,
      note: input.note?.trim() || null,
      status: "open",
      metadata: {},
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

export async function loadOpenRequestsBySeriesIds(
  client: SupabaseClient<Database>,
  seriesIds: string[],
): Promise<Map<string, RecurringSeriesRequestSummary>> {
  const map = new Map<string, RecurringSeriesRequestSummary>();
  if (seriesIds.length === 0) return map;

  const { data, error } = await client
    .from("recurring_series_requests")
    .select("*")
    .in("series_id", seriesIds)
    .in("status", ["open", "acknowledged"])
    .order("created_at", { ascending: false });

  if (error) return map;

  for (const row of (data ?? []) as RecurringSeriesRequestRow[]) {
    if (!map.has(row.series_id)) {
      map.set(row.series_id, mapRow(row));
    }
  }
  return map;
}

export async function loadLatestRequestsBySeriesIds(
  client: SupabaseClient<Database>,
  seriesIds: string[],
): Promise<Map<string, RecurringSeriesRequestSummary>> {
  const map = new Map<string, RecurringSeriesRequestSummary>();
  if (seriesIds.length === 0) return map;

  const { data, error } = await client
    .from("recurring_series_requests")
    .select("*")
    .in("series_id", seriesIds)
    .order("created_at", { ascending: false });

  if (error) return map;

  for (const row of (data ?? []) as RecurringSeriesRequestRow[]) {
    if (!map.has(row.series_id)) {
      map.set(row.series_id, mapRow(row));
    }
  }
  return map;
}

export async function loadAllRequestsForSeriesIds(
  client: SupabaseClient<Database>,
  seriesIds: string[],
): Promise<RecurringSeriesRequestSummary[]> {
  if (seriesIds.length === 0) return [];

  const { data, error } = await client
    .from("recurring_series_requests")
    .select("*")
    .in("series_id", seriesIds)
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []).map((row) => mapRow(row as RecurringSeriesRequestRow));
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
  options: { acknowledgeOnly?: boolean } = {},
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
  if (request.status === "resolved") {
    return { ok: true, message: "Request already resolved." };
  }

  const nextStatus: RecurringSeriesRequestStatus = options.acknowledgeOnly
    ? "acknowledged"
    : "resolved";

  const patch: Record<string, unknown> = { status: nextStatus };
  if (nextStatus === "resolved") {
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

  const { data: series } = await client
    .from("booking_series")
    .select("created_from_booking_id")
    .eq("id", request.series_id)
    .maybeSingle();

  if (series?.created_from_booking_id) {
    await recordRecurringSeriesAudit(client, {
      anchorBookingId: series.created_from_booking_id as string,
      action: "RECURRING_CUSTOMER_REQUEST",
      seriesId: request.series_id,
      actorType: "admin",
      actorProfileId: user.profileId,
      metadata: {
        requestId,
        requestResolution: nextStatus,
        requestType: request.request_type,
      },
    });
  }

  return {
    ok: true,
    message:
      nextStatus === "acknowledged"
        ? "Request marked acknowledged."
        : "Request marked resolved.",
  };
}
