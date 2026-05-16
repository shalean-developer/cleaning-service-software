import {
  FIXED_CLEANER_PAYOUT_CENTS,
  MAX_PERCENT_PAYOUT_CENTS,
  MIN_PERCENT_PAYOUT_CENTS,
  SERVICE_CATALOG,
} from "./catalog";
import type {
  CleanerEarningsPreview,
  PricingQuoteFailure,
  ServiceSlug,
} from "./types";

function fail(
  code: PricingQuoteFailure["code"],
  message: string,
): PricingQuoteFailure {
  return { ok: false, code, message };
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function assertSafePayoutCents(cents: number): boolean {
  return Number.isFinite(cents) && cents > 0 && Number.isInteger(cents);
}

export function computeCleanerEarningsPreview(params: {
  serviceSlug: ServiceSlug;
  customerTotalCents: number;
  teamSize: number;
  cleanerTenureMonths?: number | null;
}): CleanerEarningsPreview | PricingQuoteFailure {
  const { serviceSlug, customerTotalCents, teamSize } = params;
  const rule = SERVICE_CATALOG[serviceSlug];
  const metadata: Record<string, unknown> = {};

  if (!Number.isFinite(customerTotalCents) || customerTotalCents <= 0) {
    return fail("UNSAFE_CLEANER_EARNINGS", "Cannot compute earnings for non-positive total.");
  }

  const isTeamJob = teamSize > 1;
  const useFixedPayout = isTeamJob || rule.fixedCleanerPayout === true;

  let perCleanerAmountCents: number;
  let ruleApplied: string;

  if (useFixedPayout) {
    perCleanerAmountCents = FIXED_CLEANER_PAYOUT_CENTS;
    ruleApplied = isTeamJob
      ? "team_fixed_per_cleaner"
      : "fixed_per_cleaner_deep_moving_carpet";
    metadata.payoutModel = "fixed";
    metadata.fixedAmountCents = FIXED_CLEANER_PAYOUT_CENTS;
  } else {
    let tenureMonths = params.cleanerTenureMonths;
    let payoutPercent = 0.6;

    if (tenureMonths == null || !Number.isFinite(tenureMonths)) {
      tenureMonths = null;
      payoutPercent = 0.6;
      metadata.fallbackReason =
        "cleaner_tenure_unknown_conservative_60_percent";
    } else if (tenureMonths >= 4) {
      payoutPercent = 0.7;
      metadata.tenureTier = "four_plus_months";
    } else {
      payoutPercent = 0.6;
      metadata.tenureTier = "under_four_months";
    }

    const raw = customerTotalCents * payoutPercent;
    perCleanerAmountCents = clampInt(
      raw,
      MIN_PERCENT_PAYOUT_CENTS,
      MAX_PERCENT_PAYOUT_CENTS,
    );
    ruleApplied = "regular_percent_with_min_max";
    metadata.payoutModel = "percent";
    metadata.payoutPercent = payoutPercent;
    metadata.rawPercentAmountCents = Math.round(raw);
    if (tenureMonths != null) metadata.cleanerTenureMonths = tenureMonths;
  }

  if (!assertSafePayoutCents(perCleanerAmountCents)) {
    return fail(
      "UNSAFE_CLEANER_EARNINGS",
      "Cleaner payout calculation produced an invalid amount.",
    );
  }

  const totalCleanerPayoutCents = perCleanerAmountCents * teamSize;

  if (!assertSafePayoutCents(totalCleanerPayoutCents)) {
    return fail(
      "UNSAFE_CLEANER_EARNINGS",
      "Total cleaner payout calculation produced an invalid amount.",
    );
  }

  if (totalCleanerPayoutCents > customerTotalCents) {
    return fail(
      "UNSAFE_CLEANER_EARNINGS",
      "Cleaner payout cannot exceed the customer total for this quote.",
    );
  }

  return {
    perCleanerAmountCents,
    teamSize,
    totalCleanerPayoutCents,
    ruleApplied,
    metadata,
  };
}
