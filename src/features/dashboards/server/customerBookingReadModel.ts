import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import { resolveActorScope } from "@/lib/auth/resolveActorScope";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PaymentRow } from "@/lib/database/types";
import {
  formatScheduleRange,
  formatZar,
  parseBookingDisplay,
} from "./parseBookingDisplay";
import { buildLifecycleTimeline } from "./lifecycleTimeline";
import type { CustomerBookingDetail, CustomerBookingListItem, PaymentSummary } from "./types";

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

function cleanerPreferenceLabel(display: ReturnType<typeof parseBookingDisplay>): string {
  if (display.cleanerPreferenceMode === "selected" && display.preferredCleanerId) {
    return "Selected cleaner (pending acceptance)";
  }
  return "Best available";
}

type BookingRowSlice = {
  id: string;
  status: CustomerBookingListItem["status"];
  scheduled_start: string;
  scheduled_end: string;
  price_cents: number;
  currency: string;
  cleaner_id: string | null;
  updated_at: string;
  metadata_raw: import("@/lib/database/types").Json;
};

function mapListItem(booking: BookingRowSlice, payment: PaymentRow | null): CustomerBookingListItem {
  const display = parseBookingDisplay(booking.metadata_raw);
  return {
    id: booking.id,
    status: booking.status,
    paymentStatus: payment?.status ?? null,
    scheduledStart: booking.scheduled_start,
    scheduledEnd: booking.scheduled_end,
    priceCents: booking.price_cents,
    currency: booking.currency,
    display,
    scheduleLabel: formatScheduleRange(booking.scheduled_start, booking.scheduled_end),
    assignedCleanerLabel: booking.cleaner_id ? "Cleaner assigned" : null,
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
    return { ok: false, code: "FORBIDDEN", message: "Customer profile not linked.", status: 403 };
  }

  const { data: bookings, error } = await client
    .from("bookings")
    .select(
      "id, status, scheduled_start, scheduled_end, price_cents, currency, cleaner_id, metadata, updated_at",
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
    items.push(
      mapListItem(
        {
          id: row.id,
          status: row.status,
          scheduled_start: row.scheduled_start,
          scheduled_end: row.scheduled_end,
          price_cents: row.price_cents,
          currency: row.currency,
          cleaner_id: row.cleaner_id,
          updated_at: row.updated_at,
          metadata_raw: row.metadata,
        },
        latestPayment(payments ?? []),
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
    return { ok: false, code: "FORBIDDEN", message: "Customer profile not linked.", status: 403 };
  }

  const { data: row, error } = await client
    .from("bookings")
    .select(
      "id, status, scheduled_start, scheduled_end, price_cents, currency, cleaner_id, metadata, created_at, updated_at, customer_id",
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

  const display = parseBookingDisplay(row.metadata);
  const paymentList = payments ?? [];

  const base = mapListItem(
    {
      id: row.id,
      status: row.status,
      scheduled_start: row.scheduled_start,
      scheduled_end: row.scheduled_end,
      price_cents: row.price_cents,
      currency: row.currency,
      cleaner_id: row.cleaner_id,
      updated_at: row.updated_at,
      metadata_raw: row.metadata,
    },
    latestPayment(paymentList),
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
      }),
      payments: toPaymentSummaries(paymentList),
      cleanerPreferenceLabel: cleanerPreferenceLabel(display),
    },
  };
}
