import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BookingSeriesRow, PaymentRow } from "@/lib/database/types";
import {
  formatScheduleRange,
  serviceLabelFromSlug,
} from "@/features/dashboards/server/parseBookingDisplay";
import { recurringFrequencyLabel, recurringSeriesStatusLabel } from "../recurringDisplay";
import {
  buildSeriesTimeline,
  findLatestPaymentByBooking,
  formatSeriesPrice,
  isPaymentRequiredStatus,
  lastCompletedVisitAt,
  parseSeriesLocation,
  resolveSeriesActionsAllowed,
} from "./recurringSeriesHelpers";
import type {
  AdminRecurringScheduleGroupListItem,
  AdminRecurringSeriesDetail,
  AdminRecurringSeriesDetailResult,
  AdminRecurringSeriesListItem,
  AdminRecurringSeriesListResult,
  AdminRecurringListQuery,
  AdminRecurringSeriesSummary,
} from "./recurringManagementTypes";
import { locationSearchTokens } from "@/features/locations/locationDisplay";
import { formatSelectedDaysShort } from "../recurringScheduleDays";
import type { RecurringScheduleGroupRow } from "@/lib/database/types";
import { ARCHIVED_CUSTOMER_LABEL } from "./recurringReadModelLabels";
import {
  countOpenRecurringSeriesRequests,
  loadLatestRequestForSeries,
  loadAllRequestsForGroup,
  loadOpenRequestsBySeriesIds,
} from "./recurringSeriesRequestsService";

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

function isSupabaseReadBlocked(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();
  return (
    code === "42501" ||
    code === "PGRST301" ||
    msg.includes("permission denied") ||
    msg.includes("row-level security")
  );
}

export type { AdminRecurringListQuery } from "./recurringManagementTypes";

const MS_PER_DAY = 86_400_000;
const OVERDUE_PAYMENT_MS = 48 * 60 * 60 * 1000;

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

  const profileEmails = new Map<string, string | null>();
  if (profileIds.length > 0) {
    const { data: profiles } = await client
      .from("profiles")
      .select("id, full_name")
      .in("id", profileIds);
    for (const p of profiles ?? []) {
      profileEmails.set(p.id, p.full_name?.trim() ?? null);
    }
  }

  for (const c of customers ?? []) {
    const profileName = c.profile_id ? profileEmails.get(c.profile_id) : null;
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

async function loadSeriesBookings(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  seriesIds: string[],
) {
  if (seriesIds.length === 0) return [];
  const { data, error } = await client
    .from("bookings")
    .select("id, series_id, status, scheduled_start, scheduled_end, metadata, created_at")
    .in("series_id", seriesIds);
  if (error) throw new Error(error.message);
  return data ?? [];
}

function toRequestBadge(
  open: Awaited<ReturnType<typeof loadLatestRequestForSeries>>,
): import("./recurringManagementTypes").RecurringSeriesRequestBadge | null {
  if (!open || (open.status !== "open" && open.status !== "acknowledged")) return null;
  return {
    id: open.id,
    requestType: open.requestType,
    requestTypeLabel: open.requestTypeLabel,
    scope: open.scope,
    scopeLabel: open.scopeLabel,
    status: open.status,
    statusLabel: open.statusLabel,
    createdAt: open.createdAt,
    statusChangedAt: open.statusChangedAt,
    note: open.note,
    customerResponse: open.customerResponse,
    targetWeekday: open.targetWeekday,
    targetWeekdayLabel: open.targetWeekdayLabel,
    requestedDateTimeIso: open.requestedDateTimeIso,
  };
}

async function loadPaymentsForBookings(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  bookingIds: string[],
): Promise<PaymentRow[]> {
  if (bookingIds.length === 0) return [];
  const { data, error } = await client
    .from("payments")
    .select("*")
    .in("booking_id", bookingIds);
  if (error) throw new Error(error.message);
  return (data ?? []) as PaymentRow[];
}

function resolveNextOccurrenceContext(
  series: BookingSeriesRow,
  bookings: Array<{
    id: string;
    status: string;
    scheduled_start: string;
    series_id: string | null;
  }>,
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
      nextOccurrencePaymentRequired: isPaymentRequiredStatus(
        atNext.status as import("@/features/bookings/server/types").BookingStatus,
      ),
    };
  }
  const earliestUnpaid = bookings
    .filter(
      (b) =>
        b.series_id === series.id &&
        isPaymentRequiredStatus(
          b.status as import("@/features/bookings/server/types").BookingStatus,
        ),
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
  bookings: Array<{
    id: string;
    status: string;
    scheduled_start: string;
    series_id: string | null;
    created_at?: string;
    metadata?: unknown;
  }>,
  nowMs: number,
): boolean {
  return bookings.some((b) => {
    if (b.series_id !== seriesId) return false;
    if (!isPaymentRequiredStatus(b.status as import("@/features/bookings/server/types").BookingStatus)) {
      return false;
    }
    const meta = (b.metadata ?? {}) as Record<string, unknown>;
    const recurring = meta.recurring as Record<string, unknown> | undefined;
    if (recurring?.generated !== true) return false;
    if (!b.created_at) return false;
    return nowMs - new Date(b.created_at).getTime() > OVERDUE_PAYMENT_MS;
  });
}

function mapListItem(
  series: BookingSeriesRow,
  bookings: Array<{
    id: string;
    status: string;
    scheduled_start: string;
    series_id: string | null;
    created_at?: string;
    metadata?: unknown;
  }>,
  customer: { name: string; email: string | null; phone: string | null },
  openRequest: import("./recurringManagementTypes").RecurringSeriesRequestBadge | null,
  nowMs: number,
): AdminRecurringSeriesListItem {
  const seriesBookings = bookings.filter((b) => b.series_id === series.id);
  const location = parseSeriesLocation(series.template_metadata);
  const nextCtx = resolveNextOccurrenceContext(series, bookings);
  const latestChild = [...seriesBookings]
    .filter((b) => b.id !== series.created_from_booking_id)
    .sort((a, b) => b.scheduled_start.localeCompare(a.scheduled_start))[0];

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
    childBookingsCount: seriesBookings.length,
    lastCompletedVisitAt: lastCompletedVisitAt(
      seriesBookings.map((b) => ({
        status: b.status as import("@/features/bookings/server/types").BookingStatus,
        scheduled_start: b.scheduled_start,
      })),
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
  };
}

function matchesSearch(item: AdminRecurringSeriesListItem, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const suburbHaystack = [item.suburb ?? "", ...locationSearchTokens(item.suburb)].join(" ").toLowerCase();
  return (
    item.customerName.toLowerCase().includes(q) ||
    (item.customerEmail?.toLowerCase().includes(q) ?? false) ||
    suburbHaystack.includes(q) ||
    item.serviceLabel.toLowerCase().includes(q) ||
    item.frequencyLabel.toLowerCase().includes(q)
  );
}

function computeSummary(
  items: AdminRecurringSeriesListItem[],
  allBookings: Array<{
    series_id: string | null;
    scheduled_start: string;
    status: string;
    created_at?: string;
    metadata?: unknown;
  }>,
  now: Date,
  openSupportRequestsCount: number,
): AdminRecurringSeriesSummary {
  const horizon = now.getTime() + 7 * MS_PER_DAY;
  const nowMs = now.getTime();
  let paymentRequiredChildrenCount = 0;
  let overdueUnpaidChildrenCount = 0;
  let nextSevenDaysCount = 0;

  for (const b of allBookings) {
    if (!b.series_id) continue;
    if (
      isPaymentRequiredStatus(
        b.status as import("@/features/bookings/server/types").BookingStatus,
      )
    ) {
      paymentRequiredChildrenCount += 1;
      const meta = (b.metadata ?? {}) as Record<string, unknown>;
      const recurring = meta.recurring as Record<string, unknown> | undefined;
      if (
        recurring?.generated === true &&
        b.created_at &&
        nowMs - new Date(b.created_at).getTime() > OVERDUE_PAYMENT_MS
      ) {
        overdueUnpaidChildrenCount += 1;
      }
    }
    if (new Date(b.scheduled_start).getTime() <= horizon) {
      nextSevenDaysCount += 1;
    }
  }

  return {
    activeCount: items.filter((s) => s.status === "active").length,
    pausedCount: items.filter((s) => s.status === "paused").length,
    paymentRequiredChildrenCount,
    overdueUnpaidChildrenCount,
    openSupportRequestsCount,
    nextSevenDaysCount,
  };
}

function seriesInNextSevenDays(
  series: BookingSeriesRow,
  bookings: Array<{ series_id: string | null; scheduled_start: string }>,
  nowMs: number,
): boolean {
  const horizon = nowMs + 7 * MS_PER_DAY;
  return bookings.some(
    (b) =>
      b.series_id === series.id &&
      new Date(b.scheduled_start).getTime() >= nowMs &&
      new Date(b.scheduled_start).getTime() <= horizon,
  );
}

export async function listAdminRecurringSeries(
  _user: CurrentUser,
  query: AdminRecurringListQuery = {},
): Promise<AdminRecurringSeriesListResult> {
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
    let seriesQuery = client.from("booking_series").select("*").order("created_at", {
      ascending: false,
    });

    if (query.status) {
      seriesQuery = seriesQuery.eq("status", query.status);
    }
    if (query.frequency) {
      seriesQuery = seriesQuery.eq("frequency", query.frequency);
    }

    const { data: seriesRows, error } = await seriesQuery;
    if (error) {
      if (isSupabaseReadBlocked(error)) {
        return {
          ok: false,
          code: "PERSISTENCE_ERROR",
          message:
            "Recurring series are not readable for this session (check booking_series RLS policies).",
          status: 500,
        };
      }
      throw new Error(error.message);
    }

    const seriesList = (seriesRows ?? []) as BookingSeriesRow[];
    const seriesIds = seriesList.map((s) => s.id);
    const allSeriesBookings = await loadSeriesBookings(client, seriesIds);

    const customerMap = await loadCustomerLabels(
      client,
      [...new Set(seriesList.map((s) => s.customer_id))],
    );
    const openRequestsMap = await loadOpenRequestsBySeriesIds(client, seriesIds);
    const now = new Date();
    const nowMs = now.getTime();
    const openSupportRequestsCount = await countOpenRecurringSeriesRequests(client);

    let items = seriesList.map((s) => {
      const open = openRequestsMap.get(s.id);
      return mapListItem(
        s,
        allSeriesBookings,
        customerMap.get(s.customer_id) ?? archivedCustomerFallback(s.customer_id),
        open
          ? {
              id: open.id,
              requestType: open.requestType,
              requestTypeLabel: open.requestTypeLabel,
              scope: open.scope,
              scopeLabel: open.scopeLabel,
              status: open.status,
              statusLabel: open.statusLabel,
              createdAt: open.createdAt,
              statusChangedAt: open.statusChangedAt,
              note: open.note,
              customerResponse: open.customerResponse,
              targetWeekday: open.targetWeekday,
              targetWeekdayLabel: open.targetWeekdayLabel,
              requestedDateTimeIso: open.requestedDateTimeIso,
            }
          : null,
        nowMs,
      );
    });

    if (query.paymentRequired) {
      items = items.filter((i) => i.nextOccurrencePaymentRequired);
    }
    if (query.overdueUnpaid) {
      items = items.filter((i) => i.hasOverdueUnpaidChild);
    }
    if (query.openRequests) {
      items = items.filter((i) => i.openSupportRequest != null);
    }
    if (query.nextSevenDays) {
      items = items.filter((i) => {
        const series = seriesList.find((s) => s.id === i.seriesId);
        return series ? seriesInNextSevenDays(series, allSeriesBookings, nowMs) : false;
      });
    }
    if (query.search?.trim()) {
      items = items.filter((i) => matchesSearch(i, query.search!));
    }

    const summary = computeSummary(items, allSeriesBookings, now, openSupportRequestsCount);

    const groupIds = [
      ...new Set(
        seriesList.map((s) => s.group_id).filter((id): id is string => Boolean(id)),
      ),
    ];
    const groups: AdminRecurringScheduleGroupListItem[] = [];
    const seriesInGroups = new Set<string>();

    if (groupIds.length > 0) {
      const { data: groupRows, error: groupError } = await client
        .from("recurring_schedule_groups")
        .select("*")
        .in("id", groupIds);
      if (groupError) throw new Error(groupError.message);

      for (const group of (groupRows ?? []) as RecurringScheduleGroupRow[]) {
        const groupSeriesItems = items.filter((i) => {
          const row = seriesList.find((s) => s.id === i.seriesId);
          return row?.group_id === group.id;
        });
        for (const item of groupSeriesItems) seriesInGroups.add(item.seriesId);
        if (groupSeriesItems.length === 0) continue;
        const first = groupSeriesItems[0]!;
        const groupSeriesIds = groupSeriesItems.map((s) => s.seriesId);
        const groupRequests = await loadAllRequestsForGroup(client, {
          groupId: group.id,
          seriesIds: groupSeriesIds,
        });
        const openCustomerRequestsCount = groupRequests.filter(
          (r) => r.status === "open" || r.status === "acknowledged",
        ).length;
        groups.push({
          groupId: group.id,
          frequency: group.frequency,
          frequencyLabel: recurringFrequencyLabel(group.frequency),
          status: group.status,
          statusLabel: recurringSeriesStatusLabel(group.status),
          serviceLabel: serviceLabelFromSlug(group.service_slug),
          selectedDaysLabel: formatSelectedDaysShort(group.selected_days),
          activeSeriesCount: groupSeriesItems.filter((s) => s.status === "active").length,
          totalUnpaidChildren: groupSeriesItems.reduce(
            (n, s) => n + (s.nextOccurrencePaymentRequired ? 1 : 0),
            0,
          ),
          openCustomerRequestsCount,
          customerId: group.customer_id,
          customerName: first.customerName,
          customerEmail: first.customerEmail,
          customerPhone: first.customerPhone,
          suburb: first.suburb,
          addressSummary: first.addressSummary,
          series: groupSeriesItems,
        });
      }
    }

    const standaloneSeries = items.filter((i) => !seriesInGroups.has(i.seriesId));
    return { ok: true, summary, groups, standaloneSeries, series: items };
  } catch (e) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: e instanceof Error ? e.message : "Could not load recurring series.",
      status: 500,
    };
  }
}

export async function getAdminRecurringSeriesDetail(
  _user: CurrentUser,
  seriesId: string,
): Promise<AdminRecurringSeriesDetailResult> {
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
    const { data: series, error } = await client
      .from("booking_series")
      .select("*")
      .eq("id", seriesId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!series) {
      return { ok: false, code: "NOT_FOUND", message: "Series not found.", status: 404 };
    }

    const row = series as BookingSeriesRow;
    const { data: bookings } = await client
      .from("bookings")
      .select("id, status, scheduled_start, scheduled_end, metadata, created_at, series_id")
      .eq("series_id", seriesId)
      .order("scheduled_start", { ascending: true });

    const bookingIds = (bookings ?? []).map((b) => b.id as string);
    const payments = await loadPaymentsForBookings(client, bookingIds);
    const paymentsByBooking = findLatestPaymentByBooking(payments);

    const customerMap = await loadCustomerLabels(client, [row.customer_id]);
    const latestRequest = await loadLatestRequestForSeries(client, seriesId);
    const nowMs = Date.now();
    const base = mapListItem(
      row,
      bookings ?? [],
      customerMap.get(row.customer_id) ?? archivedCustomerFallback(row.customer_id),
      toRequestBadge(latestRequest),
      nowMs,
    );

    const { data: audits } = await client
      .from("booking_state_audit")
      .select("command, metadata, created_at, reason")
      .eq("booking_id", row.created_from_booking_id)
      .order("created_at", { ascending: false })
      .limit(20);

    const auditNotes = (audits ?? [])
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

    const detail: AdminRecurringSeriesDetail = {
      ...base,
      timezone: row.timezone,
      priceCents: row.price_cents,
      priceLabel: formatSeriesPrice(row.price_cents),
      anchorScheduledStart: row.anchor_scheduled_start,
      timeline: buildSeriesTimeline({
        series: row,
        bookings: (bookings ?? []) as Parameters<typeof buildSeriesTimeline>[0]["bookings"],
        paymentsByBookingId: paymentsByBooking,
      }),
      auditNotes,
    };

    return { ok: true, series: detail };
  } catch (e) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: e instanceof Error ? e.message : "Could not load series detail.",
      status: 500,
    };
  }
}
