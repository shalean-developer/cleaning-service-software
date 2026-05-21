import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import { customerProvisioningApiFailure } from "@/lib/auth/customerReadiness";
import { resolveActorScope } from "@/lib/auth/resolveActorScope";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BookingStatus } from "@/features/bookings/server/types";
import type { PaymentRow } from "@/lib/database/types";
import { isOfferOpenForOps } from "@/features/assignments/server/buildOfferExpiry";
import {
  enrichBookingDisplayWithAssignmentVisibility,
  formatScheduleRange,
  formatZar,
  parseBookingDisplay,
} from "./parseBookingDisplay";
import {
  isUpcomingCustomerBooking,
  resolvePaymentFailureReason,
  showsPrePaymentAssignmentExpectation,
} from "@/features/bookings/server/paymentFailureDisplay";
import { assessPaymentRetryEligibility } from "@/features/bookings/server/paymentRetryEligibility";
import { resolveDeferredDispatchStatus } from "@/features/assignments/server/deferredDispatchStatus";
import { buildLifecycleTimeline } from "./lifecycleTimeline";
import type { CustomerBookingDetail, CustomerBookingListItem, PaymentSummary } from "./types";
import type { BookingRow, BookingStateAuditRow } from "@/lib/database/types";

function latestPayment(payments: PaymentRow[]): PaymentRow | null {
  if (payments.length === 0) return null;
  return [...payments].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]!;
}

function toPaymentSummaries(payments: PaymentRow[]): PaymentSummary[] {
  return payments.map((p) => ({
    id: p.id,
    status: p.status,
    amountCents: p.amount_cents,
    currency: p.currency,
    provider: p.provider,
    providerRef: p.provider_ref,
  }));
}

function cleanerPreferenceLabel(
  display: ReturnType<typeof parseBookingDisplay>,
  bookingStatus: BookingStatus,
): string {
  if (!showsPrePaymentAssignmentExpectation(bookingStatus)) {
    return "No cleaner assigned until payment is completed";
  }
  if (display.cleanerPreferenceMode === "selected" && display.preferredCleanerId) {
    return "Selected cleaner (pending acceptance)";
  }
  return "Best available";
}

async function loadPaymentFailureReason(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  bookingId: string,
  status: BookingStatus,
): Promise<string | null> {
  if (status !== "payment_failed") return null;
  const { data: audits } = await client
    .from("booking_state_audit")
    .select("command, metadata, created_at")
    .eq("booking_id", bookingId)
    .eq("command", "MARK_PAYMENT_FAILED")
    .order("created_at", { ascending: false })
    .limit(5);
  return resolvePaymentFailureReason((audits ?? []) as BookingStateAuditRow[]);
}

type BookingRowSlice = {
  id: string;
  status: CustomerBookingListItem["status"];
  scheduled_start: string;
  scheduled_end: string;
  assignment_dispatch_at: string | null;
  price_cents: number;
  currency: string;
  cleaner_id: string | null;
  series_id: string | null;
  updated_at: string;
  metadata_raw: import("@/lib/database/types").Json;
};

function mapListItem(
  booking: BookingRowSlice,
  payment: PaymentRow | null,
  paymentFailureReason: string | null,
  displayOverride?: ReturnType<typeof parseBookingDisplay>,
): CustomerBookingListItem {
  const displayBase = displayOverride ?? parseBookingDisplay(booking.metadata_raw);
  const deferred = resolveDeferredDispatchStatus({
    bookingStatus: booking.status,
    assignmentDispatchAt: booking.assignment_dispatch_at,
    scheduledStart: booking.scheduled_start,
  });
  const display = deferred.customerMessage
    ? {
        ...displayBase,
        assignmentCustomerMessage: deferred.customerMessage,
        showCustomerAssignmentWarning: false,
        assignmentVisibilityKey: null,
        assignmentAttention: null,
      }
    : displayBase;
  return {
    id: booking.id,
    status: booking.status,
    paymentStatus: payment?.status ?? null,
    paymentFailureReason,
    isUpcoming: isUpcomingCustomerBooking(booking.status),
    scheduledStart: booking.scheduled_start,
    scheduledEnd: booking.scheduled_end,
    priceCents: booking.price_cents,
    currency: booking.currency,
    seriesId: booking.series_id,
    isSeriesVisit: Boolean(booking.series_id),
    display,
    scheduleLabel: formatScheduleRange(booking.scheduled_start, booking.scheduled_end),
    assignedCleanerLabel:
      booking.cleaner_id && showsPrePaymentAssignmentExpectation(booking.status)
        ? "Cleaner assigned"
        : null,
    deferredAssignmentMessage: deferred.customerMessage,
    updatedAt: booking.updated_at,
  };
}

export async function listCustomerBookings(
  user: CurrentUser,
): Promise<
  | { ok: true; bookings: CustomerBookingListItem[] }
  | { ok: false; code: string; message: string; status: number }
> {
  if (user.role !== "customer") {
    return { ok: false, code: "FORBIDDEN", message: "Customers only.", status: 403 };
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return { ok: false, code: "AUTH_NOT_CONFIGURED", message: "Supabase not configured.", status: 503 };
  }

  const ctx = await resolveActorScope(client, user.profileId, user.role);
  if (!ctx.actingCustomerId) {
    return customerProvisioningApiFailure();
  }

  const { data: bookings, error } = await client
    .from("bookings")
    .select(
      "id, status, scheduled_start, scheduled_end, assignment_dispatch_at, price_cents, currency, cleaner_id, series_id, metadata, updated_at",
    )
    .eq("customer_id", ctx.actingCustomerId)
    .order("scheduled_start", { ascending: false });

  if (error) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: error.message, status: 500 };
  }

  const items: CustomerBookingListItem[] = [];
  for (const row of bookings ?? []) {
    const { data: payments } = await client
      .from("payments")
      .select("*")
      .eq("booking_id", row.id);
    const paymentFailureReason = await loadPaymentFailureReason(
      client,
      row.id,
      row.status,
    );
    let display = parseBookingDisplay(row.metadata);
    if (row.status === "pending_assignment") {
      const { data: offers } = await client
        .from("assignment_offers")
        .select("status, expires_at")
        .eq("booking_id", row.id);
      display = enrichBookingDisplayWithAssignmentVisibility(display, {
        bookingStatus: row.status,
        metadata: row.metadata,
        hasOpenOffer: (offers ?? []).some((o) => isOfferOpenForOps(o)),
        offerStatuses: (offers ?? []).map((o) => o.status),
      });
    }
    items.push(
      mapListItem(
        {
          id: row.id,
          status: row.status,
          scheduled_start: row.scheduled_start,
          scheduled_end: row.scheduled_end,
          assignment_dispatch_at: row.assignment_dispatch_at ?? null,
          price_cents: row.price_cents,
          currency: row.currency,
          cleaner_id: row.cleaner_id,
          series_id: row.series_id ?? null,
          updated_at: row.updated_at,
          metadata_raw: row.metadata,
        },
        latestPayment(payments ?? []),
        paymentFailureReason,
        display,
      ),
    );
  }

  return { ok: true, bookings: items };
}

export async function getCustomerBookingDetail(
  user: CurrentUser,
  bookingId: string,
): Promise<
  | { ok: true; booking: CustomerBookingDetail }
  | { ok: false; code: string; message: string; status: number }
> {
  if (user.role !== "customer") {
    return { ok: false, code: "FORBIDDEN", message: "Customers only.", status: 403 };
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return { ok: false, code: "AUTH_NOT_CONFIGURED", message: "Supabase not configured.", status: 503 };
  }

  const ctx = await resolveActorScope(client, user.profileId, user.role);
  if (!ctx.actingCustomerId) {
    return customerProvisioningApiFailure();
  }

  const { data: row, error } = await client
    .from("bookings")
    .select(
      "id, status, scheduled_start, scheduled_end, assignment_dispatch_at, price_cents, currency, cleaner_id, series_id, metadata, created_at, updated_at, customer_id",
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: error.message, status: 500 };
  }
  if (!row || row.customer_id !== ctx.actingCustomerId) {
    return { ok: false, code: "NOT_FOUND", message: "Booking not found.", status: 404 };
  }

  const { data: payments } = await client.from("payments").select("*").eq("booking_id", row.id);
  const { data: audits } = await client
    .from("booking_state_audit")
    .select("*")
    .eq("booking_id", row.id)
    .order("created_at", { ascending: true });

  let display = parseBookingDisplay(row.metadata);
  const paymentList = payments ?? [];

  const paymentFailureReason = resolvePaymentFailureReason(audits ?? []);

  if (row.status === "pending_assignment") {
    const { data: offers } = await client
      .from("assignment_offers")
      .select("status, expires_at")
      .eq("booking_id", row.id);
    display = enrichBookingDisplayWithAssignmentVisibility(display, {
      bookingStatus: row.status,
      metadata: row.metadata,
      hasOpenOffer: (offers ?? []).some((o) => isOfferOpenForOps(o)),
      offerStatuses: (offers ?? []).map((o) => o.status),
    });
  }

  const base = mapListItem(
    {
      id: row.id,
      status: row.status,
      scheduled_start: row.scheduled_start,
      scheduled_end: row.scheduled_end,
      assignment_dispatch_at: row.assignment_dispatch_at ?? null,
      price_cents: row.price_cents,
      currency: row.currency,
      cleaner_id: row.cleaner_id,
      series_id: row.series_id ?? null,
      updated_at: row.updated_at,
      metadata_raw: row.metadata,
    },
    latestPayment(paymentList),
    paymentFailureReason,
    display,
  );

  return {
    ok: true,
    booking: {
      ...base,
      timeline: buildLifecycleTimeline({
        bookingStatus: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        payments: paymentList,
        audits: audits ?? [],
        paymentFailureReason,
        audience: "customer",
      }),
      payments: toPaymentSummaries(paymentList),
      cleanerPreferenceLabel: cleanerPreferenceLabel(display, row.status),
      canRetryPayment: assessPaymentRetryEligibility(row as BookingRow, paymentList),
    },
  };
}
