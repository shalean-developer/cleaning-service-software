import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { findSeriesByCreatedFromBookingId } from "@/features/recurring/bookingSeriesRepository";
import { findScheduleGroupByAnchorBookingId, listSeriesIdsForGroup } from "@/features/recurring/recurringScheduleGroupRepository";
import type { Database } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import {
  parseAdminBookingRecurringScheduleFromMetadata,
  type ParsedAdminBookingRecurringSchedule,
} from "./adminBookingRecurringDisplay";

export type AdminBookingRecurringMaterializationStatus =
  | "not_applicable"
  | "pending_payment"
  | "pending_materialization"
  | "succeeded";

export type AdminBookingRecurringVerification = {
  readOnly: true;
  schedule: ParsedAdminBookingRecurringSchedule;
  materializationStatus: AdminBookingRecurringMaterializationStatus;
  materializationStatusLabel: string;
  groupId: string | null;
  groupHref: string | null;
  seriesIds: string[];
  primarySeriesId: string | null;
  nextOccurrenceAt: string | null;
  nextOccurrencePreview: string | null;
  generatedOccurrenceCount: number;
  latestGeneratedOccurrenceAt: string | null;
  diagnostics: {
    bookingSeriesId: string | null;
    anchorBookingId: string;
    seriesLinkedToBooking: boolean;
    groupLinked: boolean;
  };
};

const POST_PAYMENT_STATUSES = new Set([
  "confirmed",
  "pending_assignment",
  "assigned",
  "in_progress",
  "completed",
  "payout_ready",
  "paid_out",
]);

function resolveMaterializationStatus(input: {
  recurringEnabled: boolean;
  bookingStatus: string;
  hasSeriesOrGroup: boolean;
}): AdminBookingRecurringMaterializationStatus {
  if (!input.recurringEnabled) return "not_applicable";
  if (input.bookingStatus === "draft" || input.bookingStatus === "pending_payment") {
    return "pending_payment";
  }
  if (POST_PAYMENT_STATUSES.has(input.bookingStatus) && !input.hasSeriesOrGroup) {
    return "pending_materialization";
  }
  if (input.hasSeriesOrGroup) return "succeeded";
  return "pending_materialization";
}

function materializationStatusLabel(status: AdminBookingRecurringMaterializationStatus): string {
  switch (status) {
    case "not_applicable":
      return "Not applicable";
    case "pending_payment":
      return "Awaiting payment confirmation";
    case "pending_materialization":
      return "Pending materialization";
    case "succeeded":
      return "Materialized";
  }
}

function formatOccurrencePreview(iso: string | null): string | null {
  if (!iso?.trim()) return null;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleString("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export async function loadAdminBookingRecurringVerification(
  bookingId: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<AdminBookingRecurringVerification | null> {
  const { data: row, error } = await client
    .from("bookings")
    .select("id, status, metadata, scheduled_start, series_id, synthetic_anchor")
    .eq("id", bookingId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!row) return null;

  const schedule = parseAdminBookingRecurringScheduleFromMetadata(
    row.metadata,
    row.scheduled_start,
  );

  const [seriesFromAnchor, groupFromAnchor] = await Promise.all([
    findSeriesByCreatedFromBookingId(client, bookingId),
    findScheduleGroupByAnchorBookingId(client, bookingId),
  ]);

  let seriesIds: string[] = [];
  if (groupFromAnchor?.id) {
    seriesIds = await listSeriesIdsForGroup(client, groupFromAnchor.id);
  } else if (seriesFromAnchor?.id) {
    seriesIds = [seriesFromAnchor.id];
  } else if (row.series_id) {
    seriesIds = [row.series_id];
  }

  const groupId = groupFromAnchor?.id ?? seriesFromAnchor?.group_id ?? null;
  const primarySeriesId = seriesFromAnchor?.id ?? row.series_id ?? seriesIds[0] ?? null;
  const hasSeriesOrGroup = seriesIds.length > 0 || Boolean(groupId);

  const materializationStatus = resolveMaterializationStatus({
    recurringEnabled: schedule.recurringEnabled,
    bookingStatus: row.status,
    hasSeriesOrGroup,
  });

  let nextOccurrenceAt: string | null = seriesFromAnchor?.next_occurrence_at ?? null;
  if (!nextOccurrenceAt && seriesIds.length > 0) {
    const { data: seriesRows } = await client
      .from("booking_series")
      .select("next_occurrence_at")
      .in("id", seriesIds)
      .not("next_occurrence_at", "is", null)
      .order("next_occurrence_at", { ascending: true })
      .limit(1);
    nextOccurrenceAt = seriesRows?.[0]?.next_occurrence_at ?? null;
  }

  let generatedOccurrenceCount = 0;
  let latestGeneratedOccurrenceAt: string | null = null;

  if (seriesIds.length > 0) {
    const { data: occurrenceRows, error: occurrenceError } = await client
      .from("bookings")
      .select("id, scheduled_start, synthetic_anchor")
      .in("series_id", seriesIds)
      .eq("synthetic_anchor", false)
      .neq("id", bookingId)
      .order("scheduled_start", { ascending: false });

    if (occurrenceError) throw new Error(occurrenceError.message);

    const generated = (occurrenceRows ?? []).filter((b) => !b.synthetic_anchor);
    generatedOccurrenceCount = generated.length;
    latestGeneratedOccurrenceAt = generated[0]?.scheduled_start ?? null;
  }

  return {
    readOnly: true,
    schedule,
    materializationStatus,
    materializationStatusLabel: materializationStatusLabel(materializationStatus),
    groupId,
    groupHref: groupId ? `/admin/recurring/groups/${groupId}` : null,
    seriesIds,
    primarySeriesId,
    nextOccurrenceAt,
    nextOccurrencePreview: formatOccurrencePreview(nextOccurrenceAt),
    generatedOccurrenceCount,
    latestGeneratedOccurrenceAt,
    diagnostics: {
      bookingSeriesId: row.series_id,
      anchorBookingId: bookingId,
      seriesLinkedToBooking: Boolean(row.series_id),
      groupLinked: Boolean(groupId),
    },
  };
}
