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
  AdminRecurringSeriesDetail,
  AdminRecurringSeriesDetailResult,
  AdminRecurringSeriesListItem,
  AdminRecurringSeriesListResult,
  AdminRecurringListQuery,
  AdminRecurringSeriesSummary,
} from "./recurringManagementTypes";
import { ARCHIVED_CUSTOMER_LABEL } from "./recurringReadModelLabels";

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

function mapListItem(
  series: BookingSeriesRow,
  bookings: Array<{
    id: string;
    status: string;
    scheduled_start: string;
    series_id: string | null;
  }>,
  customer: { name: string; email: string | null; phone: string | null },
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
  return (
    item.customerName.toLowerCase().includes(q) ||
    (item.customerEmail?.toLowerCase().includes(q) ?? false) ||
    (item.suburb?.toLowerCase().includes(q) ?? false) ||
    item.serviceLabel.toLowerCase().includes(q) ||
    item.frequencyLabel.toLowerCase().includes(q)
  );
}

function computeSummary(
  items: AdminRecurringSeriesListItem[],
  allBookings: Array<{ series_id: string | null; scheduled_start: string; status: string }>,
  now: Date,
): AdminRecurringSeriesSummary {
  const horizon = now.getTime() + 7 * MS_PER_DAY;
  let paymentRequiredChildrenCount = 0;
  let nextSevenDaysCount = 0;

  for (const b of allBookings) {
    if (!b.series_id) continue;
    if (
      isPaymentRequiredStatus(
        b.status as import("@/features/bookings/server/types").BookingStatus,
      )
    ) {
      paymentRequiredChildrenCount += 1;
    }
    if (new Date(b.scheduled_start).getTime() <= horizon) {
      nextSevenDaysCount += 1;
    }
  }

  return {
    activeCount: items.filter((s) => s.status === "active").length,
    pausedCount: items.filter((s) => s.status === "paused").length,
    paymentRequiredChildrenCount,
    nextSevenDaysCount,
  };
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
    const bookings = await loadSeriesBookings(client, seriesIds);
    const customerMap = await loadCustomerLabels(
      client,
      [...new Set(seriesList.map((s) => s.customer_id))],
    );

    let items = seriesList.map((s) =>
      mapListItem(
        s,
        bookings,
        customerMap.get(s.customer_id) ?? archivedCustomerFallback(s.customer_id),
      ),
    );

    if (query.paymentRequired) {
      items = items.filter((i) => i.nextOccurrencePaymentRequired);
    }
    if (query.search?.trim()) {
      items = items.filter((i) => matchesSearch(i, query.search!));
    }

    const summary = computeSummary(items, bookings, new Date());
    return { ok: true, summary, series: items };
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
    const base = mapListItem(
      row,
      bookings ?? [],
      customerMap.get(row.customer_id) ?? archivedCustomerFallback(row.customer_id),
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
