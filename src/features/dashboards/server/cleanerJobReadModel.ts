import "server-only";

import { getCleanerOffers } from "@/features/assignments/server/getCleanerOffers";
import { isOfferPastExpiry } from "@/features/assignments/server/buildOfferExpiry";
import type { CurrentUser } from "@/lib/auth/types";
import { resolveActorScope } from "@/lib/auth/resolveActorScope";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildLifecycleTimeline } from "./lifecycleTimeline";
import { formatScheduleRange, parseBookingDisplay } from "./parseBookingDisplay";
import { resolveCleanerEarningsDisplay } from "./resolveCleanerEarningsDisplay";
import type { CleanerJobDetail, CleanerJobListItem, CleanerOfferListItem } from "./types";

const JOB_STATUSES = ["assigned", "in_progress", "completed", "payout_ready", "paid_out"] as const;

export async function listCleanerOffersForDashboard(
  user: CurrentUser,
): Promise<
  | { ok: true; offers: CleanerOfferListItem[] }
  | { ok: false; code: string; message: string; status: number }
> {
  const result = await getCleanerOffers(user);
  if (!result.ok) return result;

  const client = await createSupabaseServerClient();
  const offers: CleanerOfferListItem[] = [];

  for (const row of result.offers) {
    let metadata: import("@/lib/database/types").Json | null = null;
    let display = parseBookingDisplay(null);
    if (client) {
      const { data: bookingMeta } = await client
        .from("bookings")
        .select("metadata")
        .eq("id", row.booking.id)
        .maybeSingle();
      metadata = bookingMeta?.metadata ?? null;
      display = parseBookingDisplay(metadata);
    }

    const earnings = resolveCleanerEarningsDisplay({
      currency: row.booking.currency,
      metadata,
      price_cents: row.booking.price_cents,
      cleaner_id: null,
      earningLines: [],
    });

    const expired = isOfferPastExpiry(row.offer.expires_at);
    offers.push({
      offerId: row.offer.id,
      bookingId: row.booking.id,
      status: row.offer.status,
      expiresAt: row.offer.expires_at,
      offeredAt: row.offer.offered_at,
      scheduleLabel: formatScheduleRange(
        row.booking.scheduled_start,
        row.booking.scheduled_end,
      ),
      locationSummary: display.locationSummary,
      serviceLabel: display.serviceLabel,
      earningsCents: earnings.earningsCents,
      earningsLabel: earnings.earningsLabel,
      isExpired: expired,
    });
  }

  return { ok: true, offers };
}

export async function listCleanerJobs(
  user: CurrentUser,
): Promise<
  | { ok: true; jobs: CleanerJobListItem[] }
  | { ok: false; code: string; message: string; status: number }
> {
  if (user.role !== "cleaner") {
    return { ok: false, code: "FORBIDDEN", message: "Cleaners only.", status: 403 };
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return { ok: false, code: "AUTH_NOT_CONFIGURED", message: "Supabase not configured.", status: 503 };
  }

  const ctx = await resolveActorScope(client, user.profileId, user.role);
  if (!ctx.actingCleanerId) {
    return { ok: false, code: "FORBIDDEN", message: "Cleaner profile not linked.", status: 403 };
  }

  const { data: bookings, error } = await client
    .from("bookings")
    .select(
      "id, status, scheduled_start, scheduled_end, price_cents, currency, metadata, updated_at, cleaner_id",
    )
    .eq("cleaner_id", ctx.actingCleanerId)
    .in("status", [...JOB_STATUSES])
    .order("scheduled_start", { ascending: true });

  if (error) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: error.message, status: 500 };
  }

  const jobs: CleanerJobListItem[] = (bookings ?? []).map((row) => {
    const display = parseBookingDisplay(row.metadata);
    const earnings = resolveCleanerEarningsDisplay({
      currency: row.currency,
      metadata: row.metadata,
      price_cents: row.price_cents,
      cleaner_id: row.cleaner_id,
      earningLines: [],
    });
    return {
      bookingId: row.id,
      status: row.status,
      scheduledStart: row.scheduled_start,
      scheduledEnd: row.scheduled_end,
      scheduleLabel: formatScheduleRange(row.scheduled_start, row.scheduled_end),
      locationSummary: display.locationSummary,
      serviceLabel: display.serviceLabel,
      earningsCents: earnings.earningsCents,
      earningsLabel: earnings.earningsLabel,
      updatedAt: row.updated_at,
    };
  });

  return { ok: true, jobs };
}

export async function getCleanerJobDetail(
  user: CurrentUser,
  bookingId: string,
): Promise<
  | { ok: true; job: CleanerJobDetail }
  | { ok: false; code: string; message: string; status: number }
> {
  if (user.role !== "cleaner") {
    return { ok: false, code: "FORBIDDEN", message: "Cleaners only.", status: 403 };
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return { ok: false, code: "AUTH_NOT_CONFIGURED", message: "Supabase not configured.", status: 503 };
  }

  const ctx = await resolveActorScope(client, user.profileId, user.role);
  if (!ctx.actingCleanerId) {
    return { ok: false, code: "FORBIDDEN", message: "Cleaner profile not linked.", status: 403 };
  }

  const { data: row, error } = await client
    .from("bookings")
    .select(
      "id, status, scheduled_start, scheduled_end, price_cents, currency, metadata, created_at, updated_at, cleaner_id",
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: error.message, status: 500 };
  }
  if (!row || row.cleaner_id !== ctx.actingCleanerId) {
    return { ok: false, code: "NOT_FOUND", message: "Job not found.", status: 404 };
  }

  const { data: audits } = await client
    .from("booking_state_audit")
    .select("*")
    .eq("booking_id", row.id)
    .order("created_at", { ascending: true });

  const { data: earningRows } = await client
    .from("earning_lines")
    .select("id, payout_amount_cents, payout_status, created_at")
    .eq("booking_id", row.id)
    .order("created_at", { ascending: false });

  const display = parseBookingDisplay(row.metadata);
  const earnings = resolveCleanerEarningsDisplay({
    currency: row.currency,
    metadata: row.metadata,
    price_cents: row.price_cents,
    cleaner_id: row.cleaner_id,
    earningLines: earningRows ?? [],
  });

  return {
    ok: true,
    job: {
      bookingId: row.id,
      status: row.status,
      scheduledStart: row.scheduled_start,
      scheduledEnd: row.scheduled_end,
      scheduleLabel: formatScheduleRange(row.scheduled_start, row.scheduled_end),
      locationSummary: display.locationSummary,
      serviceLabel: display.serviceLabel,
      earningsCents: earnings.earningsCents,
      earningsLabel: earnings.earningsLabel,
      updatedAt: row.updated_at,
      timeline: buildLifecycleTimeline({
        bookingStatus: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        payments: [],
        audits: audits ?? [],
      }),
      specialInstructions: display.specialInstructions,
      earnings: (earningRows ?? []).map((e) => ({
        id: e.id,
        payoutAmountCents: e.payout_amount_cents,
        payoutStatus: e.payout_status,
        createdAt: e.created_at,
      })),
    },
  };
}
