import type { AdminCustomerListItem } from "./types";

export type AdminCustomerRegistryViewFilter =
  | "all"
  | "recurring"
  | "vip"
  | "new"
  | "attention";

export type AdminCustomerCareFlag =
  | "vip"
  | "recurring"
  | "high_value"
  | "first_time"
  | "reschedule";

export type AdminCustomerCareFlagTone = "brand" | "neutral" | "warning";

export type AdminCustomerRegistryCardModel = {
  customerId: string;
  href: string;
  initials: string;
  name: string;
  areaLabel: string;
  isRecurring: boolean;
  bookingsLabel: string;
  lastVisitLabel: string;
  lifetimeLabel: string;
  careFlags: { id: AdminCustomerCareFlag; label: string; tone: AdminCustomerCareFlagTone }[];
  footnote: string | null;
};

export type AdminCustomerRegistryStats = {
  totalCustomers: number;
  recurringCustomers: number;
  lifetimeValueCents: number;
};

const MS_PER_DAY = 86_400_000;
const HIGH_VALUE_LIFETIME_CENTS = 12_000_00;
const NEW_CUSTOMER_MAX_AGE_MS = 30 * MS_PER_DAY;

export function customerInitialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function formatRegistryZar(cents: number): string {
  const value = Math.round(cents / 100);
  const formatted = new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(value);
  return formatted.replace(/\u00A0/g, " ");
}

export function formatRelativeLastVisit(iso: string | null, nowMs = Date.now()): string {
  if (!iso) return "—";

  const visitMs = new Date(iso).getTime();
  const diffMs = nowMs - visitMs;
  const days = Math.floor(diffMs / MS_PER_DAY);

  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) {
    return new Date(visitMs).toLocaleDateString("en-ZA", { weekday: "short" });
  }
  if (days < 14) return "1 wk ago";
  if (days < 28) return "2 wks ago";
  if (days < 60) return "1 mo ago";

  return new Date(visitMs).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
  });
}

export function isVipCustomer(item: Pick<AdminCustomerListItem, "notes" | "companyName">): boolean {
  const haystack = `${item.notes ?? ""} ${item.companyName}`.toLowerCase();
  return /\bvip\b/.test(haystack);
}

export function isNewCustomer(
  item: Pick<AdminCustomerListItem, "createdAt" | "bookingCount">,
  nowMs = Date.now(),
): boolean {
  const createdMs = new Date(item.createdAt).getTime();
  return (
    item.bookingCount <= 1 ||
    nowMs - createdMs <= NEW_CUSTOMER_MAX_AGE_MS
  );
}

export function needsCustomerAttention(
  item: Pick<AdminCustomerListItem, "provisioningHealthy" | "domainHealth" | "latestBooking">,
): boolean {
  if (!item.provisioningHealthy) return true;
  if (item.domainHealth.tone !== "success") return true;
  if (item.latestBooking?.status === "cancelled") return true;
  return false;
}

export function hasRescheduleSignal(
  item: Pick<AdminCustomerListItem, "latestBooking" | "bookingCount">,
): boolean {
  return item.bookingCount > 0 && item.latestBooking?.status === "cancelled";
}

export function resolveCustomerCareFlags(
  item: AdminCustomerListItem,
): AdminCustomerRegistryCardModel["careFlags"] {
  const flags: AdminCustomerRegistryCardModel["careFlags"] = [];

  if (isVipCustomer(item)) {
    flags.push({ id: "vip", label: "VIP", tone: "brand" });
  }
  if (item.recurringCount > 0) {
    flags.push({ id: "recurring", label: "Recurring", tone: "neutral" });
  }
  if (item.lifetimeValueCents >= HIGH_VALUE_LIFETIME_CENTS) {
    flags.push({ id: "high_value", label: "High value", tone: "brand" });
  }
  if (item.bookingCount <= 1) {
    flags.push({ id: "first_time", label: "First-time", tone: "neutral" });
  }
  if (hasRescheduleSignal(item)) {
    flags.push({ id: "reschedule", label: "Reschedule", tone: "warning" });
  }

  return flags;
}

export function buildAdminCustomerRegistryCardModel(
  item: AdminCustomerListItem,
): AdminCustomerRegistryCardModel {
  const careFlags = resolveCustomerCareFlags(item);
  const footnote =
    item.preferredCleanerLabel != null
      ? `Preferred · ${item.preferredCleanerLabel}`
      : null;

  return {
    customerId: item.customerId,
    href: `/admin/customers/${item.customerId}`,
    initials: customerInitialsFromName(item.companyName),
    name: item.companyName,
    areaLabel: item.areaLabel ?? "—",
    isRecurring: item.recurringCount > 0,
    bookingsLabel: String(item.bookingCount),
    lastVisitLabel: formatRelativeLastVisit(item.lastVisitAt),
    lifetimeLabel:
      item.lifetimeValueCents > 0 ? formatRegistryZar(item.lifetimeValueCents) : "—",
    careFlags,
    footnote,
  };
}

export function computeAdminCustomerRegistryStats(
  items: AdminCustomerListItem[],
): AdminCustomerRegistryStats {
  let recurringCustomers = 0;
  let lifetimeValueCents = 0;

  for (const item of items) {
    if (item.recurringCount > 0) recurringCustomers += 1;
    lifetimeValueCents += item.lifetimeValueCents;
  }

  return {
    totalCustomers: items.length,
    recurringCustomers,
    lifetimeValueCents,
  };
}

export function normalizeAdminCustomerRegistryViewFilter(
  param: string | undefined,
): AdminCustomerRegistryViewFilter {
  if (
    param === "recurring" ||
    param === "vip" ||
    param === "new" ||
    param === "attention"
  ) {
    return param;
  }
  return "all";
}

export function matchesAdminCustomerRegistryViewFilter(
  item: AdminCustomerListItem,
  view: AdminCustomerRegistryViewFilter,
): boolean {
  switch (view) {
    case "all":
      return true;
    case "recurring":
      return item.recurringCount > 0;
    case "vip":
      return isVipCustomer(item);
    case "new":
      return isNewCustomer(item);
    case "attention":
      return needsCustomerAttention(item);
  }
}

export function matchesAdminCustomerRegistrySearch(
  item: AdminCustomerListItem,
  query: string | undefined,
): boolean {
  const q = query?.trim().toLowerCase();
  if (!q || q.length < 2) return true;

  const card = buildAdminCustomerRegistryCardModel(item);
  const haystack = [
    item.companyName,
    item.authEmail ?? "",
    item.phone ?? "",
    item.areaLabel ?? "",
    item.preferredCleanerLabel ?? "",
    ...card.careFlags.map((flag) => flag.label),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(q);
}

export function filterAdminCustomersForRegistryView(input: {
  items: AdminCustomerListItem[];
  view: AdminCustomerRegistryViewFilter;
  search?: string;
}): AdminCustomerListItem[] {
  return input.items.filter(
    (item) =>
      matchesAdminCustomerRegistryViewFilter(item, input.view) &&
      matchesAdminCustomerRegistrySearch(item, input.search),
  );
}
