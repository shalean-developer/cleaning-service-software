import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AssignmentOfferRow, PaymentRow } from "@/lib/database/types";
import { buildLifecycleTimeline } from "./lifecycleTimeline";
import {
  formatScheduleRange,
  formatZar,
  parseBookingDisplay,
} from "./parseBookingDisplay";
import type {
  AdminAssignmentQueueItem,
  AdminBookingDetail,
  AdminBookingListItem,
  OfferSummary,
  PaymentSummary,
} from "./types";

async function resolveCustomerLabel(
  client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  customerId: string,
): Promise<string> {
  if (!client) return customerId.slice(0, 8);
  const { data } = await client
    .from("customers")
    .select("company_name")
    .eq("id", customerId)
    .maybeSingle();
  return data?.company_name?.trim() || `Customer ${customerId.slice(0, 8)}`;
}

async function resolveCleanerLabel(
  client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  cleanerId: string | null,
): Promise<string | null> {
  if (!cleanerId || !client) return null;
  const { data: cleaner } = await client
    .from("cleaners")
    .select("profile_id")
    .eq("id", cleanerId)
    .maybeSingle();
  if (!cleaner) return `Cleaner ${cleanerId.slice(0, 8)}`;
  const { data: profile } = await client
    .from("profiles")
    .select("full_name")
    .eq("id", cleaner.profile_id)
    .maybeSingle();
  return profile?.full_name?.trim() || `Cleaner ${cleanerId.slice(0, 8)}`;
}

function latestPayment(payments: PaymentRow[]): PaymentRow | null {
  if (!payments.length) return null;
  return [...payments].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]!;
}

async function mapOffers(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  offers: AssignmentOfferRow[],
): Promise<OfferSummary[]> {
  const mapped: OfferSummary[] = [];
  for (const offer of offers) {
    mapped.push({
      id: offer.id,
      cleanerId: offer.cleaner_id,
      cleanerName: await resolveCleanerLabel(client, offer.cleaner_id),
      status: offer.status,
      offeredAt: offer.offered_at,
      expiresAt: offer.expires_at,
      respondedAt: offer.responded_at,
    });
  }
  return mapped;
}

export async function listAdminBookings(
  user: CurrentUser,
): Promise<
  | { ok: true; bookings: AdminBookingListItem[] }
  | { ok: false; code: string; message: string; status: number }
> {
  if (user.role !== "admin") {
    return { ok: false, code: "FORBIDDEN", message: "Admins only.", status: 403 };
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return { ok: false, code: "AUTH_NOT_CONFIGURED", message: "Supabase not configured.", status: 503 };
  }

  const { data: bookings, error } = await client
    .from("bookings")
    .select(
      "id, status, customer_id, cleaner_id, scheduled_start, scheduled_end, price_cents, currency, metadata, updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: error.message, status: 500 };
  }

  const items: AdminBookingListItem[] = [];
  for (const row of bookings ?? []) {
    const { data: payments } = await client.from("payments").select("*").eq("booking_id", row.id);
    const payment = latestPayment(payments ?? []);
    const display = parseBookingDisplay(row.metadata);
    items.push({
      id: row.id,
      status: row.status,
      paymentStatus: payment?.status ?? null,
      customerLabel: await resolveCustomerLabel(client, row.customer_id),
      cleanerLabel: await resolveCleanerLabel(client, row.cleaner_id),
      serviceLabel: display.serviceLabel,
      scheduleLabel: formatScheduleRange(row.scheduled_start, row.scheduled_end),
      priceLabel: formatZar(row.price_cents, row.currency),
      assignmentAttention: display.assignmentAttention,
      updatedAt: row.updated_at,
    });
  }

  return { ok: true, bookings: items };
}

export async function getAdminBookingDetail(
  user: CurrentUser,
  bookingId: string,
): Promise<
  | { ok: true; booking: AdminBookingDetail }
  | { ok: false; code: string; message: string; status: number }
> {
  if (user.role !== "admin") {
    return { ok: false, code: "FORBIDDEN", message: "Admins only.", status: 403 };
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return { ok: false, code: "AUTH_NOT_CONFIGURED", message: "Supabase not configured.", status: 503 };
  }

  const { data: row, error } = await client
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: error.message, status: 500 };
  }
  if (!row) {
    return { ok: false, code: "NOT_FOUND", message: "Booking not found.", status: 404 };
  }

  const { data: payments } = await client.from("payments").select("*").eq("booking_id", row.id);
  const { data: offers } = await client
    .from("assignment_offers")
    .select("*")
    .eq("booking_id", row.id)
    .order("offered_at", { ascending: false });
  const { data: audits } = await client
    .from("booking_state_audit")
    .select("*")
    .eq("booking_id", row.id)
    .order("created_at", { ascending: true });

  const paymentList = payments ?? [];
  const payment = latestPayment(paymentList);
  const display = parseBookingDisplay(row.metadata);

  const { data: earningRows } = await client
    .from("earning_lines")
    .select("id, cleaner_id, gross_amount_cents, payout_amount_cents, payout_status")
    .eq("booking_id", row.id);

  const paymentIds = paymentList.map((p) => p.id);
  let paymentEvents: AdminBookingDetail["paymentEvents"] = [];
  if (paymentIds.length > 0) {
    const { data: events } = await client
      .from("payment_events")
      .select("id, event_type, received_at, payment_id")
      .in("payment_id", paymentIds)
      .order("received_at", { ascending: false });
    paymentEvents = (events ?? []).map((e) => ({
      id: e.id,
      eventType: e.event_type,
      at: e.received_at,
    }));
  }

  return {
    ok: true,
    booking: {
      id: row.id,
      status: row.status,
      paymentStatus: payment?.status ?? null,
      customerId: row.customer_id,
      cleanerId: row.cleaner_id,
      customerLabel: await resolveCustomerLabel(client, row.customer_id),
      cleanerLabel: await resolveCleanerLabel(client, row.cleaner_id),
      serviceLabel: display.serviceLabel,
      scheduleLabel: formatScheduleRange(row.scheduled_start, row.scheduled_end),
      priceLabel: formatZar(row.price_cents, row.currency),
      assignmentAttention: display.assignmentAttention,
      updatedAt: row.updated_at,
      display,
      timeline: buildLifecycleTimeline({
        bookingStatus: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        payments: paymentList,
        audits: audits ?? [],
      }),
      payments: paymentList.map((p) => ({
        id: p.id,
        status: p.status,
        amountCents: p.amount_cents,
        currency: p.currency,
        provider: p.provider,
        providerRef: p.provider_ref,
      })),
      offers: await mapOffers(client, offers ?? []),
      earnings: (earningRows ?? []).map((e) => ({
        id: e.id,
        cleanerId: e.cleaner_id,
        payoutAmountCents: e.payout_amount_cents,
        grossAmountCents: e.gross_amount_cents,
        payoutStatus: e.payout_status,
      })),
      audits: (audits ?? []).map((a) => ({
        id: a.id,
        command: a.command,
        from: a.from_status,
        to: a.to_status,
        at: a.created_at,
      })),
      paymentEvents,
    },
  };
}

export async function listAdminAssignmentQueue(
  user: CurrentUser,
): Promise<
  | { ok: true; items: AdminAssignmentQueueItem[] }
  | { ok: false; code: string; message: string; status: number }
> {
  if (user.role !== "admin") {
    return { ok: false, code: "FORBIDDEN", message: "Admins only.", status: 403 };
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return { ok: false, code: "AUTH_NOT_CONFIGURED", message: "Supabase not configured.", status: 503 };
  }

  const { data: bookings, error } = await client
    .from("bookings")
    .select(
      "id, status, customer_id, scheduled_start, scheduled_end, metadata, updated_at",
    )
    .in("status", ["pending_assignment", "confirmed"])
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: error.message, status: 500 };
  }

  const items: AdminAssignmentQueueItem[] = [];

  for (const row of bookings ?? []) {
    const display = parseBookingDisplay(row.metadata);
    const needsAttention =
      display.assignmentAttention === "attention_required" ||
      row.status === "pending_assignment";

    if (!needsAttention && row.status !== "pending_assignment") continue;

    const { data: offers } = await client
      .from("assignment_offers")
      .select("*")
      .eq("booking_id", row.id);

    const openOffers = (offers ?? []).filter((o) => o.status === "offered");

    if (
      display.assignmentAttention !== "attention_required" &&
      openOffers.length === 0 &&
      row.status !== "pending_assignment"
    ) {
      continue;
    }

    items.push({
      bookingId: row.id,
      status: row.status,
      customerLabel: await resolveCustomerLabel(client, row.customer_id),
      serviceLabel: display.serviceLabel,
      scheduleLabel: formatScheduleRange(row.scheduled_start, row.scheduled_end),
      assignmentAttention: display.assignmentAttention ?? "pending_assignment",
      assignmentReason: display.assignmentReason,
      openOffers: await mapOffers(client, openOffers),
      updatedAt: row.updated_at,
    });
  }

  return { ok: true, items };
}
