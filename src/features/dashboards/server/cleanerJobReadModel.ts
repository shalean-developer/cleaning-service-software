import "server-only";

import { getCleanerOffers } from "@/features/assignments/server/getCleanerOffers";
import { isOfferPastExpiry } from "@/features/assignments/server/buildOfferExpiry";
import { isSupportOfferTeamRole, offerTeamRole } from "@/features/assignments/server/offerTeamRole";
import { isTeamOffersEnabled } from "@/features/assignments/server/teamOffersConfig";
import type { CurrentUser } from "@/lib/auth/types";
import { resolveActorScope } from "@/lib/auth/resolveActorScope";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database/types";
import { buildLifecycleTimeline } from "./lifecycleTimeline";
import { formatScheduleRange, parseBookingDisplay } from "./parseBookingDisplay";
import { resolveCleanerEarningsDisplay } from "./resolveCleanerEarningsDisplay";
import {
  cleanerCanViewJobDetail,
  labelForOfferTeamRole,
  loadAcceptedSupportBookingIds,
  loadRosterRowForCleaner,
  resolveCleanerJobTeamContext,
  resolveCleanerViewerRole,
  resolveSupportCleanerEarningsDisplay,
  resolveSupportOfferEarningsDisplay,
  labelForCleanerViewerRole,
  buildSupportParticipationContext,
} from "./cleanerTeamJobVisibility";
import type { CleanerJobDetail, CleanerJobListItem, CleanerOfferListItem } from "./types";

const JOB_STATUSES = ["assigned", "in_progress", "completed", "payout_ready", "paid_out"] as const;

type BookingJobRow = {
  id: string;
  status: string;
  scheduled_start: string;
  scheduled_end: string;
  price_cents: number;
  currency: string;
  metadata: Json | null;
  updated_at: string;
  cleaner_id: string | null;
  created_at?: string;
};

function mapBookingToJobListItem(
  row: BookingJobRow,
  viewerRole: import("./cleanerTeamJobVisibility").CleanerViewerJobRole,
  isTeamJob: boolean,
): CleanerJobListItem {
  const display = parseBookingDisplay(row.metadata);
  const isSupport = viewerRole === "support";

  const earnings = isSupport
    ? resolveSupportOfferEarningsDisplay()
    : resolveCleanerEarningsDisplay({
        currency: row.currency,
        metadata: row.metadata,
        price_cents: row.price_cents,
        cleaner_id: row.cleaner_id,
        earningLines: [],
      });

  return {
    bookingId: row.id,
    status: row.status as CleanerJobListItem["status"],
    scheduledStart: row.scheduled_start,
    scheduledEnd: row.scheduled_end,
    scheduleLabel: formatScheduleRange(row.scheduled_start, row.scheduled_end),
    locationSummary: display.locationSummary,
    serviceLabel: display.serviceLabel,
    earningsCents: earnings.earningsCents,
    earningsLabel: earnings.earningsLabel,
    updatedAt: row.updated_at,
    teamRoleLabel: labelForCleanerViewerRole(viewerRole),
    isTeamJob,
  };
}

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
    let metadata: Json | null = null;
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

    const isSupportOffer =
      isTeamOffersEnabled() && isSupportOfferTeamRole(offerTeamRole(row.offer));

    const earnings = isSupportOffer
      ? resolveSupportOfferEarningsDisplay()
      : resolveCleanerEarningsDisplay({
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
      teamRoleLabel: labelForOfferTeamRole(row.offer),
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

  const teamEnabled = isTeamOffersEnabled();

  const { data: leadBookings, error: leadError } = await client
    .from("bookings")
    .select(
      "id, status, scheduled_start, scheduled_end, price_cents, currency, metadata, updated_at, cleaner_id",
    )
    .eq("cleaner_id", ctx.actingCleanerId)
    .in("status", [...JOB_STATUSES])
    .order("scheduled_start", { ascending: true });

  if (leadError) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: leadError.message, status: 500 };
  }

  const jobsById = new Map<string, CleanerJobListItem>();

  for (const row of leadBookings ?? []) {
    jobsById.set(
      row.id,
      mapBookingToJobListItem(row, "lead", teamEnabled && parseBookingDisplay(row.metadata).isTwoCleanerRequest),
    );
  }

  if (teamEnabled) {
    const supportBookingIds = await loadAcceptedSupportBookingIds(client, ctx.actingCleanerId);
    const missingIds = supportBookingIds.filter((id) => !jobsById.has(id));

    if (missingIds.length > 0) {
      const { data: supportBookings, error: supportError } = await client
        .from("bookings")
        .select(
          "id, status, scheduled_start, scheduled_end, price_cents, currency, metadata, updated_at, cleaner_id",
        )
        .in("id", missingIds)
        .in("status", [...JOB_STATUSES])
        .order("scheduled_start", { ascending: true });

      if (supportError) {
        return { ok: false, code: "PERSISTENCE_ERROR", message: supportError.message, status: 500 };
      }

      for (const row of supportBookings ?? []) {
        jobsById.set(row.id, mapBookingToJobListItem(row, "support", true));
      }
    }
  }

  const jobs = [...jobsById.values()].sort((a, b) =>
    a.scheduledStart.localeCompare(b.scheduledStart),
  );

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
  if (!row) {
    return { ok: false, code: "NOT_FOUND", message: "Job not found.", status: 404 };
  }

  const teamEnabled = isTeamOffersEnabled();
  const rosterRow =
    teamEnabled ? await loadRosterRowForCleaner(client, bookingId, ctx.actingCleanerId) : null;

  if (
    !cleanerCanViewJobDetail(row.cleaner_id, ctx.actingCleanerId, rosterRow, teamEnabled)
  ) {
    return { ok: false, code: "NOT_FOUND", message: "Job not found.", status: 404 };
  }

  const viewerRole = resolveCleanerViewerRole(
    row.cleaner_id,
    ctx.actingCleanerId,
    rosterRow,
    teamEnabled,
  );
  const isSupport = viewerRole === "support";

  const { data: audits } = await client
    .from("booking_state_audit")
    .select("*")
    .eq("booking_id", row.id)
    .order("created_at", { ascending: true });

  const { data: earningRows } = await client
    .from("earning_lines")
    .select("id, cleaner_id, payout_amount_cents, payout_status, created_at")
    .eq("booking_id", row.id)
    .order("created_at", { ascending: false });

  const ownEarningRows =
    (earningRows ?? []).filter((l) => l.cleaner_id === ctx.actingCleanerId);

  const display = parseBookingDisplay(row.metadata);
  const supportParticipation = buildSupportParticipationContext(
    viewerRole,
    rosterRow,
    row.status,
  );
  const earnings = isSupport
    ? resolveSupportCleanerEarningsDisplay({
        currency: row.currency,
        metadata: row.metadata,
        price_cents: row.price_cents,
        cleaner_id: ctx.actingCleanerId,
        earningLines: ownEarningRows,
        hasMarkedParticipation: supportParticipation.hasMarkedParticipation,
      })
    : resolveCleanerEarningsDisplay({
        currency: row.currency,
        metadata: row.metadata,
        price_cents: row.price_cents,
        cleaner_id: row.cleaner_id,
        earningLines: ownEarningRows,
      });

  const team = await resolveCleanerJobTeamContext(
    client,
    row.id,
    row.cleaner_id,
    ctx.actingCleanerId,
    display.isTwoCleanerRequest,
    row.status,
  );

  const listBase = mapBookingToJobListItem(row, viewerRole, team.isTeamJob);

  return {
    ok: true,
    job: {
      ...listBase,
      timeline: buildLifecycleTimeline({
        bookingStatus: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        payments: [],
        audits: audits ?? [],
        audience: "cleaner",
      }),
      homeSizeSummary: display.homeSizeSummary,
      cleaningIntensityLabel: display.cleaningIntensityLabel,
      equipmentSupplyOperationalLabel: display.equipmentSupplyOperationalLabel,
      teamSupportCleanerNote: display.teamSupportCleanerNote,
      specialInstructions: display.specialInstructions,
      operationalAccessNotes: display.operationalAccessNotes,
      earnings: ownEarningRows.map((e) => ({
        id: e.id,
        payoutAmountCents: e.payout_amount_cents,
        payoutStatus: e.payout_status as CleanerJobDetail["earnings"][0]["payoutStatus"],
        createdAt: e.created_at,
      })),
      team,
    },
  };
}
