import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import type { EarningPayoutStatus, Json } from "@/lib/database/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveCleanerLabels } from "@/features/dashboards/server/bookingCleanersReadModel";
import { isRecurringAdminBooking } from "@/features/dashboards/server/adminBookingRecurring";
import {
  resolveServiceSlugFromMetadata,
  serviceLabelFromSlug,
} from "@/features/dashboards/server/parseBookingDisplay";
import { cleanerInitialsFromName } from "@/features/cleaners/server/admin/adminCleanersNetworkDisplay";
import type {
  AdminEarningsCleanerPayoutRow,
  AdminEarningsPeriod,
  AdminEarningsPayoutStatus,
  AdminEarningsServiceMixItem,
  AdminEarningsSummaryCard,
  AdminEarningsView,
} from "./adminEarningsDisplay";
import {
  formatCleanerEarningsPeriodLabel,
  resolveAdminEarningsPeriodBounds,
} from "./adminEarningsPeriod";
import { formatEarningsZar } from "./adminEarningsDisplay";

type PaidPaymentSlice = {
  amount_cents: number;
  booking_id: string;
};

type BookingRevenueSlice = {
  id: string;
  metadata: Json;
  series_id: string | null;
};

type EarningLineSlice = {
  id: string;
  cleaner_id: string;
  booking_id: string | null;
  gross_amount_cents: number;
  payout_amount_cents: number;
  payout_status: EarningPayoutStatus;
};

function formatRevenueTrend(currentCents: number, previousCents: number): string | undefined {
  if (previousCents <= 0) {
    if (currentCents > 0) return "New vs prior period";
    return undefined;
  }
  const delta = ((currentCents - previousCents) / previousCents) * 100;
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}% vs prior period`;
}

function aggregateCleanerStatus(
  statuses: EarningPayoutStatus[],
): AdminEarningsPayoutStatus {
  if (statuses.some((s) => s === "pending")) return "held";
  if (statuses.some((s) => s === "payout_ready")) return "scheduled";
  return "released";
}

function buildServiceMix(
  revenueByService: Map<string, { label: string; cents: number }>,
  totalRevenueCents: number,
): AdminEarningsServiceMixItem[] {
  if (totalRevenueCents <= 0) return [];

  return [...revenueByService.entries()]
    .map(([id, entry]) => ({
      id,
      label: entry.label,
      mixPercent: Math.round((entry.cents / totalRevenueCents) * 100),
      amountCents: entry.cents,
    }))
    .sort((a, b) => b.amountCents - a.amountCents);
}

function buildSummaryCards(input: {
  bounds: ReturnType<typeof resolveAdminEarningsPeriodBounds>;
  revenueCents: number;
  previousRevenueCents: number;
  recurringSharePercent: number;
  payoutsQueuedCents: number;
  cleanerSharePercent: number;
}): AdminEarningsSummaryCard[] {
  const trend = formatRevenueTrend(input.revenueCents, input.previousRevenueCents);

  return [
    {
      id: "revenue",
      label: input.bounds.revenueCardLabel,
      value: formatEarningsZar(input.revenueCents),
      footer: "Paid bookings in period",
      trend,
    },
    {
      id: "recurring",
      label: "Recurring share",
      value:
        input.revenueCents > 0
          ? `${input.recurringSharePercent}% recurring`
          : "—",
      footer: "Series-linked bookings of total",
    },
    {
      id: "queued",
      label: "Payouts queued",
      value: formatEarningsZar(input.payoutsQueuedCents),
      footer: "Payout-ready across all cleaners",
    },
    {
      id: "cleaner-share",
      label: "Cleaner share",
      value:
        input.revenueCents > 0 || input.cleanerSharePercent > 0
          ? `${input.cleanerSharePercent}% cleaner share`
          : "—",
      footer: "Payout vs gross earnings in period",
    },
  ];
}

export async function loadAdminEarningsView(
  user: CurrentUser,
  period: AdminEarningsPeriod,
): Promise<
  | { ok: true; view: AdminEarningsView }
  | { ok: false; code: string; message: string; status: number }
> {
  if (user.role !== "admin") {
    return { ok: false, code: "FORBIDDEN", message: "Admins only.", status: 403 };
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return { ok: false, code: "AUTH_NOT_CONFIGURED", message: "Supabase not configured.", status: 503 };
  }

  const bounds = resolveAdminEarningsPeriodBounds(period);

  const [
    { data: periodPayments, error: paymentsError },
    { data: previousPayments, error: previousPaymentsError },
    { data: periodLines, error: linesError },
    { data: queuedLines, error: queuedError },
  ] = await Promise.all([
    client
      .from("payments")
      .select("amount_cents, booking_id")
      .eq("status", "paid")
      .gte("created_at", bounds.startIso)
      .lt("created_at", bounds.endExclusiveIso),
    client
      .from("payments")
      .select("amount_cents")
      .eq("status", "paid")
      .gte("created_at", bounds.previousStartIso)
      .lt("created_at", bounds.previousEndExclusiveIso),
    client
      .from("earning_lines")
      .select(
        "id, cleaner_id, booking_id, gross_amount_cents, payout_amount_cents, payout_status",
      )
      .gte("created_at", bounds.startIso)
      .lt("created_at", bounds.endExclusiveIso),
    client
      .from("earning_lines")
      .select("payout_amount_cents")
      .eq("payout_status", "payout_ready"),
  ]);

  if (paymentsError) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: paymentsError.message, status: 500 };
  }
  if (previousPaymentsError) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: previousPaymentsError.message,
      status: 500,
    };
  }
  if (linesError) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: linesError.message, status: 500 };
  }
  if (queuedError) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: queuedError.message, status: 500 };
  }

  const paymentRows = (periodPayments ?? []) as PaidPaymentSlice[];
  const bookingIds = [...new Set(paymentRows.map((p) => p.booking_id).filter(Boolean))];
  const bookingById = new Map<string, BookingRevenueSlice>();

  if (bookingIds.length > 0) {
    const { data: bookingRows, error: bookingsError } = await client
      .from("bookings")
      .select("id, metadata, series_id")
      .in("id", bookingIds);

    if (bookingsError) {
      return {
        ok: false,
        code: "PERSISTENCE_ERROR",
        message: bookingsError.message,
        status: 500,
      };
    }

    for (const row of (bookingRows ?? []) as BookingRevenueSlice[]) {
      bookingById.set(row.id, row);
    }
  }

  let revenueCents = 0;
  let recurringRevenueCents = 0;
  const revenueByService = new Map<string, { label: string; cents: number }>();

  for (const payment of paymentRows) {
    revenueCents += payment.amount_cents;
    const booking = bookingById.get(payment.booking_id) ?? null;
    if (
      booking &&
      isRecurringAdminBooking({ seriesId: booking.series_id, metadata: booking.metadata })
    ) {
      recurringRevenueCents += payment.amount_cents;
    }

    const slug =
      resolveServiceSlugFromMetadata(booking?.metadata ?? null) ?? "unknown";
    const label = serviceLabelFromSlug(slug);
    const existing = revenueByService.get(slug);
    if (existing) {
      existing.cents += payment.amount_cents;
    } else {
      revenueByService.set(slug, { label, cents: payment.amount_cents });
    }
  }

  const previousRevenueCents = (previousPayments ?? []).reduce(
    (sum, row) => sum + row.amount_cents,
    0,
  );

  const lines = (periodLines ?? []) as EarningLineSlice[];
  let grossEarningsCents = 0;
  let payoutEarningsCents = 0;
  const cleanerBuckets = new Map<
    string,
    {
      amountCents: number;
      statuses: EarningPayoutStatus[];
      bookingIds: Set<string>;
      primaryBookingId: string | null;
    }
  >();

  for (const line of lines) {
    grossEarningsCents += line.gross_amount_cents;
    payoutEarningsCents += line.payout_amount_cents;

    const bucket = cleanerBuckets.get(line.cleaner_id) ?? {
      amountCents: 0,
      statuses: [],
      bookingIds: new Set<string>(),
      primaryBookingId: null,
    };
    bucket.amountCents += line.payout_amount_cents;
    bucket.statuses.push(line.payout_status);
    if (line.booking_id) {
      bucket.bookingIds.add(line.booking_id);
      if (!bucket.primaryBookingId && line.payout_status !== "paid") {
        bucket.primaryBookingId = line.booking_id;
      }
    }
    cleanerBuckets.set(line.cleaner_id, bucket);
  }

  const payoutsQueuedCents = (queuedLines ?? []).reduce(
    (sum, row) => sum + row.payout_amount_cents,
    0,
  );

  const recurringSharePercent =
    revenueCents > 0 ? Math.round((recurringRevenueCents / revenueCents) * 100) : 0;
  const cleanerSharePercent =
    grossEarningsCents > 0
      ? Math.round((payoutEarningsCents / grossEarningsCents) * 100)
      : 0;

  const cleanerIds = [...cleanerBuckets.keys()];
  const cleanerLabels = await resolveCleanerLabels(client, cleanerIds);

  const cleanerPayouts: AdminEarningsCleanerPayoutRow[] = cleanerIds
    .map((cleanerId) => {
      const bucket = cleanerBuckets.get(cleanerId)!;
      const name = cleanerLabels.get(cleanerId) ?? `Cleaner ${cleanerId.slice(0, 8)}`;
      return {
        id: cleanerId,
        initials: cleanerInitialsFromName(name),
        name,
        periodLabel: formatCleanerEarningsPeriodLabel(period, bucket.bookingIds.size),
        amountCents: bucket.amountCents,
        status: aggregateCleanerStatus(bucket.statuses),
        href: `/admin/cleaners/${cleanerId}`,
        primaryBookingId: bucket.primaryBookingId,
      };
    })
    .sort((a, b) => b.amountCents - a.amountCents);

  const payoutTotals = {
    scheduledCents: lines
      .filter((l) => l.payout_status === "payout_ready")
      .reduce((s, l) => s + l.payout_amount_cents, 0),
    releasedCents: lines
      .filter((l) => l.payout_status === "paid")
      .reduce((s, l) => s + l.payout_amount_cents, 0),
    heldCents: lines
      .filter((l) => l.payout_status === "pending")
      .reduce((s, l) => s + l.payout_amount_cents, 0),
  };

  const view: AdminEarningsView = {
    period,
    periodMixLabel: bounds.periodMixLabel,
    summaryCards: buildSummaryCards({
      bounds,
      revenueCents,
      previousRevenueCents,
      recurringSharePercent,
      payoutsQueuedCents,
      cleanerSharePercent,
    }),
    serviceMix: buildServiceMix(revenueByService, revenueCents),
    payoutTotals,
    cleanerPayouts,
  };

  return { ok: true, view };
}
