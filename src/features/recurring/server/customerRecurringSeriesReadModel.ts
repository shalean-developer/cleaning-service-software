import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import { customerProvisioningApiFailure } from "@/lib/auth/customerReadiness";
import { resolveActorScope } from "@/lib/auth/resolveActorScope";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BookingSeriesRow, PaymentRow } from "@/lib/database/types";
import { formatScheduleRange, serviceLabelFromSlug } from "@/features/dashboards/server/parseBookingDisplay";
import { recurringFrequencyLabel, recurringSeriesStatusLabel } from "../recurringDisplay";
import {
  buildSeriesTimeline,
  findLatestPaymentByBooking,
  isPaymentRequiredStatus,
  parseSeriesLocation,
  resolveSeriesActionsAllowed,
} from "./recurringSeriesHelpers";
import type {
  CustomerRecurringSeriesDetail,
  CustomerRecurringSeriesDetailResult,
  CustomerRecurringSeriesListItem,
  CustomerRecurringSeriesListResult,
} from "./recurringManagementTypes";

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

const COMPLETED = new Set(["completed", "payout_ready", "paid_out"]);
const PAID_UPCOMING = new Set([
  "confirmed",
  "pending_assignment",
  "assigned",
  "in_progress",
]);

async function resolveCustomerId(
  user: CurrentUser,
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
): Promise<string | null> {
  const ctx = await resolveActorScope(client, user.profileId, user.role);
  return ctx.actingCustomerId ?? null;
}

function resolveNextOccurrenceContext(
  series: BookingSeriesRow,
  bookings: Array<{ id: string; status: string; scheduled_start: string }>,
) {
  if (!series.next_occurrence_at) {
    return { nextOccurrenceBookingId: null, nextOccurrencePaymentRequired: false };
  }
  const atNext = bookings.find((b) => b.scheduled_start === series.next_occurrence_at);
  if (atNext) {
    return {
      nextOccurrenceBookingId: atNext.id,
      nextOccurrencePaymentRequired: isPaymentRequiredStatus(
        atNext.status as import("@/features/bookings/server/types").BookingStatus,
      ),
    };
  }
  const earliestUnpaid = bookings
    .filter((b) =>
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

function mapCustomerListItem(
  series: BookingSeriesRow,
  bookings: Array<{ id: string; status: string; scheduled_start: string }>,
): CustomerRecurringSeriesListItem {
  const location = parseSeriesLocation(series.template_metadata);
  const nextCtx = resolveNextOccurrenceContext(series, bookings);

  const unpaidChildCount = bookings.filter((b) =>
    isPaymentRequiredStatus(
      b.status as import("@/features/bookings/server/types").BookingStatus,
    ),
  ).length;
  const paidUpcomingCount = bookings.filter(
    (b) =>
      PAID_UPCOMING.has(
        b.status as import("@/features/bookings/server/types").BookingStatus,
      ) && new Date(b.scheduled_start) >= new Date(),
  ).length;
  const completedVisitCount = bookings.filter((b) =>
    COMPLETED.has(b.status as import("@/features/bookings/server/types").BookingStatus),
  ).length;

  return {
    seriesId: series.id,
    frequency: series.frequency,
    frequencyLabel: recurringFrequencyLabel(series.frequency),
    status: series.status,
    statusLabel: recurringSeriesStatusLabel(series.status),
    serviceLabel: serviceLabelFromSlug(series.service_slug),
    suburb: location.suburb,
    locationSummary: location.addressSummary,
    nextOccurrenceAt: series.next_occurrence_at,
    nextOccurrenceScheduleLabel: series.next_occurrence_at
      ? formatScheduleRange(series.next_occurrence_at, series.next_occurrence_at)
      : null,
    nextOccurrencePaymentRequired: nextCtx.nextOccurrencePaymentRequired,
    nextOccurrenceBookingId: nextCtx.nextOccurrenceBookingId,
    unpaidChildCount,
    paidUpcomingCount,
    completedVisitCount,
    actions: resolveSeriesActionsAllowed({
      status: series.status,
      nextOccurrencePaymentRequired: nextCtx.nextOccurrencePaymentRequired,
      nextOccurrenceBookingId: nextCtx.nextOccurrenceBookingId,
      isCustomer: true,
    }),
  };
}

export async function listCustomerRecurringSeries(
  user: CurrentUser,
): Promise<CustomerRecurringSeriesListResult> {
  const client = await createSupabaseServerClient();
  if (!client) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: "Database unavailable.",
      status: 500,
    };
  }

  const customerId = await resolveCustomerId(user, client);
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
    const { data: seriesRows, error } = await client
      .from("booking_series")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    if (error) {
      if (isSupabaseReadBlocked(error)) {
        return {
          ok: false,
          code: "PERSISTENCE_ERROR",
          message:
            "Could not load recurring series for your account (permissions). Sign in again or contact support.",
          status: 500,
        };
      }
      throw new Error(error.message);
    }

    const seriesList = (seriesRows ?? []) as BookingSeriesRow[];
    const seriesIds = seriesList.map((s) => s.id);
    if (seriesIds.length === 0) {
      return {
        ok: true,
        series: [],
        emptyReason: "none_for_account",
      };
    }

    const { data: bookings } = await client
      .from("bookings")
      .select("id, status, scheduled_start, series_id")
      .in("series_id", seriesIds);

    const bySeries = new Map<string, Array<{ id: string; status: string; scheduled_start: string }>>();
    for (const b of bookings ?? []) {
      const sid = b.series_id as string;
      const list = bySeries.get(sid) ?? [];
      list.push({
        id: b.id as string,
        status: b.status as string,
        scheduled_start: b.scheduled_start as string,
      });
      bySeries.set(sid, list);
    }

    const items = seriesList.map((s) =>
      mapCustomerListItem(s, bySeries.get(s.id) ?? []),
    );
    return { ok: true, series: items, emptyReason: undefined };
  } catch (e) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: e instanceof Error ? e.message : "Could not load recurring series.",
      status: 500,
    };
  }
}

export async function getCustomerRecurringSeriesDetail(
  user: CurrentUser,
  seriesId: string,
): Promise<CustomerRecurringSeriesDetailResult> {
  const client = await createSupabaseServerClient();
  if (!client) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: "Database unavailable.",
      status: 500,
    };
  }

  const customerId = await resolveCustomerId(user, client);
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
    if (row.customer_id !== customerId) {
      return { ok: false, code: "FORBIDDEN", message: "Not your series.", status: 403 };
    }

    const { data: bookings } = await client
      .from("bookings")
      .select("id, status, scheduled_start, scheduled_end, metadata, created_at")
      .eq("series_id", seriesId)
      .order("scheduled_start", { ascending: true });

    const bookingIds = (bookings ?? []).map((b) => b.id as string);
    const { data: payments } = await client
      .from("payments")
      .select("*")
      .in("booking_id", bookingIds);
    const paymentsByBooking = findLatestPaymentByBooking((payments ?? []) as PaymentRow[]);

    const base = mapCustomerListItem(
      row,
      (bookings ?? []).map((b) => ({
        id: b.id as string,
        status: b.status as string,
        scheduled_start: b.scheduled_start as string,
      })),
    );

    return {
      ok: true,
      series: {
        ...base,
        createdFromBookingId: row.created_from_booking_id,
        timeline: buildSeriesTimeline({
          series: row,
          bookings: (bookings ?? []) as Parameters<typeof buildSeriesTimeline>[0]["bookings"],
          paymentsByBookingId: paymentsByBooking,
        }),
      },
    };
  } catch (e) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: e instanceof Error ? e.message : "Could not load series.",
      status: 500,
    };
  }
}
