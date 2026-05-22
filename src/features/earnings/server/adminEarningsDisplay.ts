import { formatRegistryZar } from "@/features/customers/server/admin/adminCustomersRegistryDisplay";

export type AdminEarningsPeriod = "today" | "week" | "month";

export type AdminEarningsSummaryCard = {
  id: string;
  label: string;
  value: string;
  footer: string;
  trend?: string;
};

export type AdminEarningsServiceMixItem = {
  id: string;
  label: string;
  mixPercent: number;
  amountCents: number;
};

export type AdminEarningsPayoutStatus = "scheduled" | "released" | "held";

export type AdminEarningsCleanerPayoutRow = {
  id: string;
  initials: string;
  name: string;
  periodLabel: string;
  amountCents: number;
  status: AdminEarningsPayoutStatus;
  href: string;
  primaryBookingId: string | null;
};

export type AdminEarningsPayoutTotals = {
  scheduledCents: number;
  releasedCents: number;
  heldCents: number;
};

export type AdminEarningsView = {
  period: AdminEarningsPeriod;
  periodMixLabel: string;
  summaryCards: AdminEarningsSummaryCard[];
  serviceMix: AdminEarningsServiceMixItem[];
  payoutTotals: AdminEarningsPayoutTotals;
  cleanerPayouts: AdminEarningsCleanerPayoutRow[];
};

export const ADMIN_EARNINGS_PERIOD_CHIPS: readonly {
  id: AdminEarningsPeriod;
  label: string;
}[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
] as const;

export const ADMIN_EARNINGS_PERIOD_SUBTITLE: Record<AdminEarningsPeriod, string> = {
  today: "Today's performance and cleaner payout pipeline.",
  week: "This week performance and cleaner payout pipeline.",
  month: "This month performance and cleaner payout pipeline.",
};

export function normalizeAdminEarningsPeriod(raw: string | undefined): AdminEarningsPeriod {
  if (raw === "today" || raw === "month") return raw;
  return "week";
}

export function formatEarningsZar(cents: number): string {
  return formatRegistryZar(cents);
}

export function payoutStatusLabel(status: AdminEarningsPayoutStatus): string {
  switch (status) {
    case "scheduled":
      return "Scheduled";
    case "released":
      return "Released";
    case "held":
      return "Held for review";
  }
}

export function payoutStatusLabelUpper(status: AdminEarningsPayoutStatus): string {
  return payoutStatusLabel(status).toUpperCase();
}

export function payoutStatusTone(
  status: AdminEarningsPayoutStatus,
): "info" | "success" | "warning" {
  switch (status) {
    case "scheduled":
      return "info";
    case "released":
      return "success";
    case "held":
      return "warning";
  }
}
