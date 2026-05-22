import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import { customerProvisioningApiFailure } from "@/lib/auth/customerReadiness";
import { resolveActorScope } from "@/lib/auth/resolveActorScope";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BookingSeriesRow, PaymentRow, RecurringScheduleGroupRow } from "@/lib/database/types";
import type { BookingStatus } from "@/features/bookings/server/types";
import {
  formatScheduleRange,
  formatZar,
  serviceLabelFromSlug,
} from "@/features/dashboards/server/parseBookingDisplay";
import { recurringFrequencyLabel, recurringSeriesStatusLabel } from "../recurringDisplay";
import {
  formatSelectedDaysShort,
  RECURRING_WEEKDAY_FULL_LABELS,
} from "../recurringScheduleDays";
import { isSyntheticAnchorBooking } from "../syntheticAnchorBooking";
import {
  findLatestPaymentByBooking,
  isPaymentRequiredStatus,
  parseSeriesLocation,
  paymentLabelForBooking,
} from "./recurringSeriesHelpers";
import type {
  CustomerRecurringGroupRequestItem,
  CustomerRecurringGroupVisitEntry,
  CustomerRecurringGroupWeekdaySeriesItem,
  CustomerRecurringScheduleGroupDetail,
  CustomerRecurringScheduleGroupDetailResult,
  RecurringSeriesRequestBadge,
} from "./recurringManagementTypes";
import { loadAllRequestsForGroup } from "./recurringSeriesRequestsService";
import { resolveCustomerGroupRequestActionsAllowed } from "./recurringGroupRequestService";

const PAID_CHILD_STATUSES = new Set<BookingStatus>([
  "confirmed",
  "pending_assignment",
  "assigned",
  "in_progress",
  "completed",
  "payout_ready",
  "paid_out",
]);

const COMPLETED_STATUSES = new Set<BookingStatus>(["completed", "payout_ready", "paid_out"]);

type SeriesBookingRow = {
  id: string;
  status: BookingStatus;
  scheduled_start: string;
  scheduled_end: string;
  series_id: string | null;
  metadata?: unknown;
  synthetic_anchor?: boolean;
  price_cents?: number | null;
};

function weekdayLabel(weekday: number | null | undefined): string {
  if (weekday == null || weekday < 0 || weekday > 6) return "-";
  return RECURRING_WEEKDAY_FULL_LABELS[weekday] ?? String(weekday);
}

function isRealVisitBooking(b: SeriesBookingRow): boolean {
  return !isSyntheticAnchorBooking({
    synthetic_anchor: b.synthetic_anchor ?? false,
    metadata: b.metadata as import("@/lib/database/types").Json,
  });
}

function resolveNextOccurrenceContext(
  series: BookingSeriesRow,
  bookings: SeriesBookingRow[],
): {
  nextOccurrenceBookingId: string | null;
  nextOccurrencePaymentRequired: boolean;
} {
  if (!series.next_occurrence_at) {
    return { nextOccurrenceBookingId: null, nextOccurrencePaymentRequired: false };
  }
  const atNext = bookings.find(
    (b) =>
      b.series_id === series.id && b.scheduled_start === series.next_occurrence_at,
  );
  if (atNext) {
    return {
      nextOccurrenceBookingId: atNext.id,
      nextOccurrencePaymentRequired: isPaymentRequiredStatus(atNext.status),
    };
  }
  const earliestUnpaid = bookings
    .filter(
      (b) => b.series_id === series.id && isPaymentRequiredStatus(b.status),
    )
    .sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start))[0];
  if (earliestUnpaid) {
    return {
      nextOccurrenceBookingId: earliestUnpaid.id,
      nextOccurrencePaymentRequired: true,
    };
  }
  return { nextOccurrenceBookingId: null, nextOccurrencePaymentRequired: false };
}

function toRequestBadge(
  req: Awaited<ReturnType<typeof loadAllRequestsForGroup>>[number],
): RecurringSeriesRequestBadge {
  return {
    id: req.id,
    requestType: req.requestType,
    requestTypeLabel: req.requestTypeLabel,
    scope: req.scope,
    scopeLabel: req.scopeLabel,
    status: req.status,
    statusLabel: req.statusLabel,
    createdAt: req.createdAt,
    statusChangedAt: req.statusChangedAt,
    note: req.note,
    customerResponse: req.customerResponse,
    targetWeekday: req.targetWeekday,
    targetWeekdayLabel: req.targetWeekdayLabel,
    requestedDateTimeIso: req.requestedDateTimeIso,
  };
}

export async function getCustomerRecurringScheduleGroupDetail(
  user: CurrentUser,
  groupId: string,
): Promise<CustomerRecurringScheduleGroupDetailResult> {
  const client = await createSupabaseServerClient();
  if (!client) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: "Database unavailable.",
      status: 500,
    };
  }

  const ctx = await resolveActorScope(client, user.profileId, user.role);
  const customerId = ctx.actingCustomerId;
  if (!customerId) {
    const provisioning = customerProvisioningApiFailure();
    if (provisioning) {
      return {
        ok: false,
        code: "PROVISIONING_INCOMPLETE",
        message: provisioning.message,
        status: provisioning.status,
      };
    }
    return {
      ok: false,
      code: "PROVISIONING_INCOMPLETE",
      message: "Customer profile is not ready.",
      status: 403,
    };
  }

  try {
    const { data: groupRow, error: groupError } = await client
      .from("recurring_schedule_groups")
      .select("*")
      .eq("id", groupId)
      .maybeSingle();
    if (groupError) throw new Error(groupError.message);
    if (!groupRow) {
      return { ok: false, code: "NOT_FOUND", message: "Schedule not found.", status: 404 };
    }

    const group = groupRow as RecurringScheduleGroupRow;
    if (group.customer_id !== customerId) {
      return { ok: false, code: "FORBIDDEN", message: "Not your schedule.", status: 403 };
    }

    const { data: seriesRows, error: seriesError } = await client
      .from("booking_series")
      .select("*")
      .eq("group_id", groupId)
      .order("weekday", { ascending: true });
    if (seriesError) throw new Error(seriesError.message);

    const seriesList = (seriesRows ?? []) as BookingSeriesRow[];
    const seriesIds = seriesList.map((s) => s.id);

    let bookings: SeriesBookingRow[] = [];
    if (seriesIds.length > 0) {
      const { data: bookingRows, error: bookingsError } = await client
        .from("bookings")
        .select(
          "id, status, scheduled_start, scheduled_end, metadata, series_id, synthetic_anchor, price_cents",
        )
        .in("series_id", seriesIds)
        .order("scheduled_start", { ascending: true });
      if (bookingsError) throw new Error(bookingsError.message);
      bookings = (bookingRows ?? []) as SeriesBookingRow[];
    }

    const bookingIds = bookings.map((b) => b.id);
    const payments =
      bookingIds.length > 0
        ? await (async () => {
            const { data, error } = await client
              .from("payments")
              .select("*")
              .in("booking_id", bookingIds);
            if (error) throw new Error(error.message);
            return (data ?? []) as PaymentRow[];
          })()
        : [];
    const paymentsByBooking = findLatestPaymentByBooking(payments);

    const allRequests = await loadAllRequestsForGroup(client, {
      groupId,
      seriesIds,
    });

    const nowMs = Date.now();
    const seriesById = new Map(seriesList.map((s) => [s.id, s]));
    const firstSeries = seriesList[0];
    const location = firstSeries
      ? parseSeriesLocation(firstSeries.template_metadata)
      : { suburb: null as string | null, addressSummary: "-" };
    const sharedTimeLabel = firstSeries?.anchor_scheduled_start
      ? formatScheduleRange(
          firstSeries.anchor_scheduled_start,
          firstSeries.anchor_scheduled_start,
        )
      : null;

    const weekdaySeries: CustomerRecurringGroupWeekdaySeriesItem[] = seriesList.map(
      (series) => {
        const seriesBookings = bookings.filter((b) => b.series_id === series.id);
        const realVisits = seriesBookings.filter(isRealVisitBooking);
        const nextCtx = resolveNextOccurrenceContext(series, bookings);
        const latestChild = [...realVisits]
          .filter((b) => b.id !== series.created_from_booking_id)
          .sort((a, b) => b.scheduled_start.localeCompare(a.scheduled_start))[0];

        return {
          seriesId: series.id,
          weekday: series.weekday ?? null,
          weekdayLabel: weekdayLabel(series.weekday),
          slotLabel: series.slot_label ?? null,
          status: series.status,
          statusLabel: recurringSeriesStatusLabel(series.status),
          nextOccurrenceAt: series.next_occurrence_at,
          nextOccurrenceScheduleLabel: series.next_occurrence_at
            ? formatScheduleRange(series.next_occurrence_at, series.next_occurrence_at)
            : null,
          nextOccurrencePaymentRequired: nextCtx.nextOccurrencePaymentRequired,
          nextOccurrenceBookingId: nextCtx.nextOccurrenceBookingId,
          unpaidChildCount: realVisits.filter((b) => isPaymentRequiredStatus(b.status)).length,
          completedChildCount: realVisits.filter((b) =>
            COMPLETED_STATUSES.has(b.status),
          ).length,
          latestVisitScheduleLabel: latestChild
            ? formatScheduleRange(latestChild.scheduled_start, latestChild.scheduled_end)
            : null,
          seriesDetailHref: `/customer/bookings/recurring/${series.id}`,
        };
      },
    );

    const realVisits = bookings.filter(isRealVisitBooking);
    const mapVisit = (b: SeriesBookingRow): CustomerRecurringGroupVisitEntry => {
      const series = b.series_id ? seriesById.get(b.series_id) : undefined;
      const payment = paymentsByBooking.get(b.id) ?? null;
      const paymentRequired = isPaymentRequiredStatus(b.status);
      const priceCents = b.price_cents ?? series?.price_cents ?? null;
      return {
        bookingId: b.id,
        seriesId: b.series_id ?? "",
        weekdayLabel: weekdayLabel(series?.weekday),
        serviceLabel: serviceLabelFromSlug(series?.service_slug ?? group.service_slug),
        scheduledStart: b.scheduled_start,
        scheduledEnd: b.scheduled_end,
        scheduleLabel: formatScheduleRange(b.scheduled_start, b.scheduled_end),
        status: b.status,
        paymentLabel: paymentLabelForBooking(b.status, payment?.status ?? null),
        priceLabel: priceCents != null ? formatZar(priceCents) : "-",
        paymentRequired,
        bookingDetailHref: `/customer/bookings/${b.id}`,
      };
    };

    const upcomingRaw = realVisits.filter(
      (b) =>
        new Date(b.scheduled_start).getTime() >= nowMs && b.status !== "cancelled",
    );
    const upcomingVisits = [...upcomingRaw]
      .sort((a, b) => {
        const aPay = isPaymentRequiredStatus(a.status) ? 0 : 1;
        const bPay = isPaymentRequiredStatus(b.status) ? 0 : 1;
        if (aPay !== bPay) return aPay - bPay;
        return a.scheduled_start.localeCompare(b.scheduled_start);
      })
      .map(mapVisit);

    const completedVisits = realVisits
      .filter((b) => COMPLETED_STATUSES.has(b.status))
      .sort((a, b) => b.scheduled_start.localeCompare(a.scheduled_start))
      .map(mapVisit);

    const nextUpcoming = upcomingRaw.sort((a, b) =>
      a.scheduled_start.localeCompare(b.scheduled_start),
    )[0];
    const nextPaymentRequired = realVisits
      .filter((b) => isPaymentRequiredStatus(b.status))
      .sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start))[0];

    const toRequestItem = (
      req: (typeof allRequests)[number],
    ): CustomerRecurringGroupRequestItem => ({
      ...toRequestBadge(req),
      seriesId: req.seriesId,
      resolvedAt: req.resolvedAt,
    });

    const openRequestCount = allRequests.filter(
      (r) => r.status === "open" || r.status === "acknowledged",
    ).length;

    const detail: CustomerRecurringScheduleGroupDetail = {
      groupId: group.id,
      serviceLabel: serviceLabelFromSlug(group.service_slug),
      frequencyLabel: recurringFrequencyLabel(group.frequency),
      status: group.status,
      statusLabel: recurringSeriesStatusLabel(group.status),
      selectedDays: group.selected_days,
      selectedDaysLabel: formatSelectedDaysShort(group.selected_days),
      subtitleLabel: `${formatSelectedDaysShort(group.selected_days)} · ${recurringFrequencyLabel(group.frequency)}`,
      timezone: group.timezone,
      label: group.label,
      createdAt: group.created_at,
      sharedTimeLabel,
      suburb: location.suburb,
      addressSummary: location.addressSummary,
      activeSeriesCount: weekdaySeries.filter((s) => s.status === "active").length,
      pausedSeriesCount: weekdaySeries.filter((s) => s.status === "paused").length,
      cancelledSeriesCount: weekdaySeries.filter((s) => s.status === "cancelled").length,
      totalChildVisits: realVisits.length,
      unpaidChildVisits: realVisits.filter((b) => isPaymentRequiredStatus(b.status)).length,
      paidChildVisits: realVisits.filter((b) => PAID_CHILD_STATUSES.has(b.status)).length,
      completedChildVisits: realVisits.filter((b) => COMPLETED_STATUSES.has(b.status)).length,
      openRequestCount,
      nextUpcomingVisit: nextUpcoming
        ? {
            bookingId: nextUpcoming.id,
            scheduleLabel: formatScheduleRange(
              nextUpcoming.scheduled_start,
              nextUpcoming.scheduled_end,
            ),
            weekdayLabel: weekdayLabel(seriesById.get(nextUpcoming.series_id ?? "")?.weekday),
          }
        : null,
      nextPaymentRequiredVisit: nextPaymentRequired
        ? {
            bookingId: nextPaymentRequired.id,
            scheduleLabel: formatScheduleRange(
              nextPaymentRequired.scheduled_start,
              nextPaymentRequired.scheduled_end,
            ),
            weekdayLabel: weekdayLabel(
              seriesById.get(nextPaymentRequired.series_id ?? "")?.weekday,
            ),
          }
        : null,
      weekdaySeries,
      upcomingVisits,
      completedVisits,
      supportRequests: {
        open: allRequests.filter((r) => r.status === "open").map(toRequestItem),
        acknowledged: allRequests
          .filter((r) => r.status === "acknowledged")
          .map(toRequestItem),
        resolved: allRequests.filter((r) => r.status === "resolved").map(toRequestItem),
        rejected: allRequests.filter((r) => r.status === "rejected").map(toRequestItem),
      },
      actions: resolveCustomerGroupRequestActionsAllowed(group.status),
    };

    return { ok: true, group: detail };
  } catch (e) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: e instanceof Error ? e.message : "Could not load schedule.",
      status: 500,
    };
  }
}
