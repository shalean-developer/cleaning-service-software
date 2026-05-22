import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BookingSeriesRow, PaymentRow, RecurringScheduleGroupRow } from "@/lib/database/types";
import type { BookingStatus } from "@/features/bookings/server/types";
import {
  formatScheduleRange,
  formatZar,
  serviceLabelFromSlug,
} from "@/features/dashboards/server/parseBookingDisplay";
import { resolveCleanerLabels } from "@/features/dashboards/server/bookingCleanersReadModel";
import { customerBookingStatusHero } from "@/features/dashboards/customerBookingDetailDisplay";
import { recurringFrequencyLabel, recurringSeriesStatusLabel } from "../recurringDisplay";
import {
  formatSelectedDaysShort,
  RECURRING_WEEKDAY_FULL_LABELS,
} from "../recurringScheduleDays";
import { isSyntheticAnchorBooking } from "../syntheticAnchorBooking";
import { ARCHIVED_CUSTOMER_LABEL } from "./recurringReadModelLabels";
import {
  findLatestPaymentByBooking,
  isPaymentRequiredStatus,
  lastCompletedVisitAt,
  parseSeriesLocation,
  paymentLabelForBooking,
  resolveSeriesActionsAllowed,
} from "./recurringSeriesHelpers";
import type {
  AdminRecurringGroupTimelineEntry,
  AdminRecurringGroupWeekdaySeriesItem,
  AdminRecurringScheduleGroupDetail,
  AdminRecurringScheduleGroupDetailResult,
  AdminRecurringSeriesListItem,
  RecurringScheduleGroupActionsAllowed,
  RecurringSeriesRequestBadge,
} from "./recurringManagementTypes";
import { loadAllRequestsForGroup } from "./recurringSeriesRequestsService";

const OVERDUE_PAYMENT_MS = 48 * 60 * 60 * 1000;

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
  created_at?: string;
  metadata?: unknown;
  synthetic_anchor?: boolean;
  price_cents?: number | null;
  cleaner_id?: string | null;
};

function archivedCustomerFallback(customerId: string): {
  name: string;
  email: string | null;
  phone: string | null;
} {
  return {
    name: ARCHIVED_CUSTOMER_LABEL,
    email: null,
    phone: null,
  };
}

function resolveGroupActionsAllowed(
  status: RecurringScheduleGroupRow["status"],
): RecurringScheduleGroupActionsAllowed {
  return {
    canPause: status === "active",
    canResume: status === "paused",
    canCancelGroup: status === "active" || status === "paused",
  };
}

function weekdayLabel(weekday: number | null | undefined): string {
  if (weekday == null || weekday < 0 || weekday > 6) return "—";
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
      (b) =>
        b.series_id === series.id &&
        isPaymentRequiredStatus(b.status),
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

function seriesHasOverdueUnpaidChild(
  seriesId: string,
  bookings: SeriesBookingRow[],
  nowMs: number,
): boolean {
  return bookings.some((b) => {
    if (b.series_id !== seriesId) return false;
    if (!isPaymentRequiredStatus(b.status)) return false;
    const meta = (b.metadata ?? {}) as Record<string, unknown>;
    const recurring = meta.recurring as Record<string, unknown> | undefined;
    if (recurring?.generated !== true) return false;
    if (!b.created_at) return false;
    return nowMs - new Date(b.created_at).getTime() > OVERDUE_PAYMENT_MS;
  });
}

function mapSeriesListItem(
  series: BookingSeriesRow,
  bookings: SeriesBookingRow[],
  customer: { name: string; email: string | null; phone: string | null },
  openRequest: RecurringSeriesRequestBadge | null,
  nowMs: number,
): AdminRecurringGroupWeekdaySeriesItem {
  const seriesBookings = bookings.filter((b) => b.series_id === series.id);
  const realVisits = seriesBookings.filter(isRealVisitBooking);
  const location = parseSeriesLocation(series.template_metadata);
  const nextCtx = resolveNextOccurrenceContext(series, bookings);
  const latestChild = [...realVisits]
    .filter((b) => b.id !== series.created_from_booking_id)
    .sort((a, b) => b.scheduled_start.localeCompare(a.scheduled_start))[0];

  const unpaidChildCount = realVisits.filter((b) =>
    isPaymentRequiredStatus(b.status),
  ).length;
  const paidChildCount = realVisits.filter((b) => PAID_CHILD_STATUSES.has(b.status)).length;
  const completedChildCount = realVisits.filter((b) =>
    COMPLETED_STATUSES.has(b.status),
  ).length;

  const nextPaymentRequiredChild = realVisits
    .filter((b) => isPaymentRequiredStatus(b.status))
    .sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start))[0];

  return {
    seriesId: series.id,
    frequency: series.frequency,
    frequencyLabel: recurringFrequencyLabel(series.frequency),
    status: series.status,
    statusLabel: recurringSeriesStatusLabel(series.status),
    customerId: series.customer_id,
    customerName: customer.name,
    customerEmail: customer.email,
    customerPhone: customer.phone,
    serviceSlug: series.service_slug,
    serviceLabel: serviceLabelFromSlug(series.service_slug),
    suburb: location.suburb,
    addressSummary: location.addressSummary,
    nextOccurrenceAt: series.next_occurrence_at,
    nextOccurrenceScheduleLabel: series.next_occurrence_at
      ? formatScheduleRange(series.next_occurrence_at, series.next_occurrence_at)
      : null,
    nextOccurrencePaymentRequired: nextCtx.nextOccurrencePaymentRequired,
    nextOccurrenceBookingId: nextCtx.nextOccurrenceBookingId,
    childBookingsCount: realVisits.length,
    lastCompletedVisitAt: lastCompletedVisitAt(
      realVisits.map((b) => ({ status: b.status, scheduled_start: b.scheduled_start })),
    ),
    createdFromBookingId: series.created_from_booking_id,
    createdAt: series.created_at,
    latestChildBookingId: latestChild?.id ?? null,
    hasOverdueUnpaidChild: seriesHasOverdueUnpaidChild(series.id, bookings, nowMs),
    openSupportRequest: openRequest,
    actions: resolveSeriesActionsAllowed({
      status: series.status,
      nextOccurrencePaymentRequired: nextCtx.nextOccurrencePaymentRequired,
      nextOccurrenceBookingId: nextCtx.nextOccurrenceBookingId,
      isCustomer: false,
    }),
    weekday: series.weekday ?? null,
    weekdayLabel: weekdayLabel(series.weekday),
    slotLabel: series.slot_label ?? null,
    unpaidChildCount,
    paidChildCount,
    completedChildCount,
    nextPaymentRequiredChildBookingId: nextPaymentRequiredChild?.id ?? null,
  };
}

async function loadCustomerLabels(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  customerIds: string[],
): Promise<
  Map<string, { name: string; email: string | null; phone: string | null }>
> {
  const map = new Map<string, { name: string; email: string | null; phone: string | null }>();
  if (customerIds.length === 0) return map;

  const { data: customers, error } = await client
    .from("customers")
    .select("id, profile_id, company_name, phone")
    .in("id", customerIds);
  if (error) throw new Error(error.message);

  const profileIds = (customers ?? [])
    .map((c) => c.profile_id)
    .filter((id): id is string => Boolean(id));

  const profileNames = new Map<string, string | null>();
  if (profileIds.length > 0) {
    const { data: profiles } = await client
      .from("profiles")
      .select("id, full_name")
      .in("id", profileIds);
    for (const p of profiles ?? []) {
      profileNames.set(p.id, p.full_name?.trim() ?? null);
    }
  }

  for (const c of customers ?? []) {
    const profileName = c.profile_id ? profileNames.get(c.profile_id) : null;
    const name =
      c.company_name?.trim() ||
      profileName ||
      `Customer ${(c.id as string).slice(0, 8)}`;
    map.set(c.id as string, {
      name,
      email: null,
      phone: c.phone?.trim() ?? null,
    });
  }

  return map;
}

function buildGroupTimeline(input: {
  bookings: SeriesBookingRow[];
  seriesById: Map<string, BookingSeriesRow>;
  paymentsByBooking: Map<string, PaymentRow | null>;
  cleanerLabels: Map<string, string>;
}): AdminRecurringGroupTimelineEntry[] {
  const sorted = [...input.bookings]
    .filter(isRealVisitBooking)
    .sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start));

  return sorted.map((b) => {
    const series = b.series_id ? input.seriesById.get(b.series_id) : undefined;
    const payment = input.paymentsByBooking.get(b.id) ?? null;
    const paymentRequired = isPaymentRequiredStatus(b.status);
    const priceCents = b.price_cents ?? series?.price_cents ?? null;
    const hero = customerBookingStatusHero(b.status, null, {
      serviceSlug: series?.service_slug ?? null,
    });

    return {
      bookingId: b.id,
      seriesId: b.series_id ?? "",
      scheduledStart: b.scheduled_start,
      scheduledEnd: b.scheduled_end,
      weekdayLabel: weekdayLabel(series?.weekday),
      status: b.status,
      paymentStatus: payment?.status ?? null,
      priceCents,
      priceLabel: priceCents != null ? formatZar(priceCents) : "—",
      cleanerLabel: b.cleaner_id
        ? (input.cleanerLabels.get(b.cleaner_id) ?? null)
        : null,
      customerStatusLabel: hero.statusLabel,
      paymentRequired,
      scheduleLabel: formatScheduleRange(b.scheduled_start, b.scheduled_end),
      paymentLabel: paymentLabelForBooking(b.status, payment?.status ?? null),
      adminBookingHref: `/admin/bookings/${b.id}`,
    };
  });
}

export async function getAdminRecurringScheduleGroupDetail(
  _user: CurrentUser,
  groupId: string,
): Promise<AdminRecurringScheduleGroupDetailResult> {
  const client = await createSupabaseServerClient();
  if (!client) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: "Database unavailable.",
      status: 500,
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
      return { ok: false, code: "NOT_FOUND", message: "Schedule group not found.", status: 404 };
    }

    const group = groupRow as RecurringScheduleGroupRow;

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
          "id, status, scheduled_start, scheduled_end, metadata, created_at, series_id, synthetic_anchor, price_cents, cleaner_id",
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

    const customerMap = await loadCustomerLabels(client, [group.customer_id]);
    const customer =
      customerMap.get(group.customer_id) ??
      archivedCustomerFallback(group.customer_id);

    const allRequests = await loadAllRequestsForGroup(client, { groupId, seriesIds });
    const latestRequestBySeries = new Map<string, (typeof allRequests)[number]>();
    for (const req of allRequests) {
      if (req.seriesId && !latestRequestBySeries.has(req.seriesId)) {
        latestRequestBySeries.set(req.seriesId, req);
      }
    }

    const nowMs = Date.now();
    const seriesById = new Map(seriesList.map((s) => [s.id, s]));

    const weekdaySeries = seriesList.map((series) => {
      const latest = latestRequestBySeries.get(series.id);
      const openBadge: RecurringSeriesRequestBadge | null =
        latest && (latest.status === "open" || latest.status === "acknowledged")
          ? {
              id: latest.id,
              requestType: latest.requestType,
              requestTypeLabel: latest.requestTypeLabel,
              scope: latest.scope,
              scopeLabel: latest.scopeLabel,
              status: latest.status,
              statusLabel: latest.statusLabel,
              createdAt: latest.createdAt,
              statusChangedAt: latest.statusChangedAt,
              note: latest.note,
              customerResponse: latest.customerResponse,
              targetWeekday: latest.targetWeekday,
              targetWeekdayLabel: latest.targetWeekdayLabel,
              requestedDateTimeIso: latest.requestedDateTimeIso,
            }
          : null;
      return mapSeriesListItem(series, bookings, customer, openBadge, nowMs);
    });

    const realVisits = bookings.filter(isRealVisitBooking);
    const unpaidChildVisits = realVisits.filter((b) =>
      isPaymentRequiredStatus(b.status),
    ).length;
    const paidChildVisits = realVisits.filter((b) => PAID_CHILD_STATUSES.has(b.status)).length;
    const completedChildVisits = realVisits.filter((b) =>
      COMPLETED_STATUSES.has(b.status),
    ).length;

    const upcoming = realVisits
      .filter(
        (b) =>
          new Date(b.scheduled_start).getTime() >= nowMs &&
          b.status !== "cancelled",
      )
      .sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start))[0];

    const overdueUnpaidCount = realVisits.filter((b) => {
      if (!isPaymentRequiredStatus(b.status)) return false;
      const meta = (b.metadata ?? {}) as Record<string, unknown>;
      const recurring = meta.recurring as Record<string, unknown> | undefined;
      if (recurring?.generated !== true || !b.created_at) return false;
      return nowMs - new Date(b.created_at).getTime() > OVERDUE_PAYMENT_MS;
    }).length;

    const openCustomerRequestsCount = allRequests.filter(
      (r) => r.status === "open" || r.status === "acknowledged",
    ).length;

    const cleanerIds = bookings
      .map((b) => b.cleaner_id)
      .filter((id): id is string => Boolean(id));
    const cleanerLabels = await resolveCleanerLabels(client, cleanerIds);

    const timeline = buildGroupTimeline({
      bookings,
      seriesById,
      paymentsByBooking,
      cleanerLabels,
    });

    const seriesWeekdayById = new Map(
      seriesList.map((s) => [s.id, weekdayLabel(s.weekday)]),
    );

    const toSupportItem = (
      req: (typeof allRequests)[number],
    ): import("./recurringManagementTypes").AdminRecurringGroupSupportRequestItem => ({
      id: req.id,
      seriesId: req.seriesId,
      groupId: req.groupId,
      weekdayLabel:
        req.targetWeekdayLabel ??
        (req.seriesId ? (seriesWeekdayById.get(req.seriesId) ?? "—") : "All weekdays"),
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
      resolvedAt: req.resolvedAt,
      targetWeekday: req.targetWeekday,
      targetWeekdayLabel: req.targetWeekdayLabel,
      requestedDateTimeIso: req.requestedDateTimeIso,
    });

    const supportRequests = {
      open: allRequests.filter((r) => r.status === "open").map(toSupportItem),
      acknowledged: allRequests
        .filter((r) => r.status === "acknowledged")
        .map(toSupportItem),
      resolved: allRequests.filter((r) => r.status === "resolved").map(toSupportItem),
    };

    const { data: audits } = await client
      .from("booking_state_audit")
      .select("command, metadata, created_at, reason")
      .eq("booking_id", group.anchor_booking_id)
      .order("created_at", { ascending: false })
      .limit(20);

    const groupAuditNotes = (audits ?? [])
      .filter((a) => String(a.command ?? "").startsWith("RECURRING"))
      .map((a) => {
        const meta =
          a.metadata != null && typeof a.metadata === "object" && !Array.isArray(a.metadata)
            ? (a.metadata as Record<string, unknown>)
            : {};
        const action =
          (meta.recurringSeries as Record<string, unknown> | undefined)?.action ?? a.command;
        return `${a.created_at}: ${String(action)}${a.reason ? ` — ${a.reason}` : ""}`;
      });

    const firstSeries = seriesList[0];
    const location = firstSeries
      ? parseSeriesLocation(firstSeries.template_metadata)
      : { suburb: null as string | null, addressSummary: "—" };

    const detail: AdminRecurringScheduleGroupDetail = {
      groupId: group.id,
      label: group.label,
      titleLabel: group.label?.trim() || "Recurring schedule group",
      customerId: group.customer_id,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      serviceSlug: group.service_slug,
      serviceLabel: serviceLabelFromSlug(group.service_slug),
      frequency: group.frequency,
      frequencyLabel: recurringFrequencyLabel(group.frequency),
      status: group.status,
      statusLabel: recurringSeriesStatusLabel(group.status),
      selectedDays: group.selected_days,
      selectedDaysLabel: formatSelectedDaysShort(group.selected_days),
      timezone: group.timezone,
      suburb: location.suburb,
      addressSummary: location.addressSummary,
      anchorBookingId: group.anchor_booking_id,
      createdAt: group.created_at,
      activeSeriesCount: weekdaySeries.filter((s) => s.status === "active").length,
      pausedSeriesCount: weekdaySeries.filter((s) => s.status === "paused").length,
      cancelledSeriesCount: weekdaySeries.filter((s) => s.status === "cancelled").length,
      totalChildVisits: realVisits.length,
      unpaidChildVisits,
      paidChildVisits,
      completedChildVisits,
      nextUpcomingVisit: upcoming
        ? {
            bookingId: upcoming.id,
            scheduleLabel: formatScheduleRange(
              upcoming.scheduled_start,
              upcoming.scheduled_end,
            ),
          }
        : null,
      overdueUnpaidCount,
      openCustomerRequestsCount,
      weekdaySeries,
      timeline,
      supportRequests,
      groupAuditNotes,
      actions: resolveGroupActionsAllowed(group.status),
    };

    return { ok: true, group: detail };
  } catch (e) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: e instanceof Error ? e.message : "Could not load schedule group detail.",
      status: 500,
    };
  }
}
