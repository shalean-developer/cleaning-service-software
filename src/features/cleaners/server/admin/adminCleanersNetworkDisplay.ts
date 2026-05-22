import type { AdminCleanerListItem } from "./types";

export type AdminCleanerNetworkStatus = "available" | "on_visit" | "paused" | "offline";

export type AdminCleanerNetworkViewFilter =
  | "all"
  | AdminCleanerNetworkStatus
  | "top_performers";

export type AdminCleanerNetworkStatusTone = "success" | "info" | "warning" | "neutral";

export type AdminCleanerNetworkCardModel = {
  id: string;
  href: string;
  initials: string;
  name: string;
  areaLabel: string;
  status: AdminCleanerNetworkStatus;
  statusLabel: string;
  statusTone: AdminCleanerNetworkStatusTone;
  ratingLabel: string;
  reviewsLabel: string;
  completionLabel: string;
  todayPrimaryLabel: string;
  todaySecondaryLabel: string;
  badgeLabels: string[];
  activityLabel: string;
};

const TOP_PERFORMER_RATING_MIN = 4.8;
const RELIABLE_RATING_MIN = 4.5;

export function cleanerInitialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function resolveCleanerNetworkStatus(
  item: AdminCleanerListItem,
): AdminCleanerNetworkStatus {
  if (item.operationalState === "archived" || item.operationalState === "onboarding") {
    return "offline";
  }
  if (
    item.operationalState === "suspended" ||
    item.operationalState === "inactive" ||
    item.isSuspended
  ) {
    return "paused";
  }
  if (item.activeBookingsCount > 0) return "on_visit";
  if (item.operationalState === "active" && item.active) return "available";
  return "offline";
}

export function labelForCleanerNetworkStatus(status: AdminCleanerNetworkStatus): string {
  const labels: Record<AdminCleanerNetworkStatus, string> = {
    available: "Available",
    on_visit: "In visit",
    paused: "Paused",
    offline: "Offline",
  };
  return labels[status];
}

export function toneForCleanerNetworkStatus(
  status: AdminCleanerNetworkStatus,
): AdminCleanerNetworkStatusTone {
  switch (status) {
    case "available":
      return "success";
    case "on_visit":
      return "info";
    case "paused":
      return "warning";
    case "offline":
      return "neutral";
  }
}

export function isTopPerformerCleaner(item: AdminCleanerListItem): boolean {
  return typeof item.averageRating === "number" && item.averageRating >= TOP_PERFORMER_RATING_MIN;
}

function formatRatingLabel(rating: number | null): string {
  if (typeof rating !== "number" || Number.isNaN(rating)) return "—";
  return rating.toFixed(2);
}

function formatReviewsLabel(_item: AdminCleanerListItem): string {
  return "—";
}

function formatCompletionLabel(item: AdminCleanerListItem): string {
  if (item.operationalState === "active" && item.active) return "—";
  return "—";
}

function formatTodayPrimaryLabel(item: AdminCleanerListItem): string {
  if (item.activeBookingsCount > 0) {
    return `${item.activeBookingsCount} · active`;
  }
  if (item.openOffersCount > 0) {
    return `0 · ${item.openOffersCount} offer${item.openOffersCount === 1 ? "" : "s"}`;
  }
  return "—";
}

function formatTodaySecondaryLabel(item: AdminCleanerListItem): string {
  if (item.pendingEarningsCount > 0) {
    return `${item.pendingEarningsCount} pending payout${item.pendingEarningsCount === 1 ? "" : "s"}`;
  }
  return item.active && item.operationalState === "active" ? "Ready" : "—";
}

function buildBadgeLabels(item: AdminCleanerListItem): string[] {
  const badges: string[] = [];
  if (isTopPerformerCleaner(item)) badges.push("Top performer");
  if (
    typeof item.averageRating === "number" &&
    item.averageRating >= RELIABLE_RATING_MIN &&
    item.operationalState === "active"
  ) {
    badges.push("Reliable");
  }
  if (item.openOffersCount > 0) badges.push("Offers open");
  return badges;
}

function formatActivityLabel(item: AdminCleanerListItem, status: AdminCleanerNetworkStatus): string {
  if (status === "on_visit") return "Active now";
  if (status === "available") return "Ready";
  if (status === "paused") {
    if (item.lastLifecycleAction?.createdAt) {
      const pausedAt = new Date(item.lastLifecycleAction.createdAt);
      const hours = Math.round((Date.now() - pausedAt.getTime()) / 3_600_000);
      if (hours >= 48) return `Paused ${Math.round(hours / 24)}d`;
      if (hours >= 1) return `Paused ${hours}h`;
      return "Paused recently";
    }
    return "Paused";
  }
  if (item.lastLifecycleAction?.createdAt) {
    const deltaMs = Date.now() - new Date(item.lastLifecycleAction.createdAt).getTime();
    const minutes = Math.round(deltaMs / 60_000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 48) return `${hours}h ago`;
  }
  return "Off duty";
}

export function buildAdminCleanerNetworkCardModel(
  item: AdminCleanerListItem,
): AdminCleanerNetworkCardModel {
  const status = resolveCleanerNetworkStatus(item);
  return {
    id: item.id,
    href: `/admin/cleaners/${item.id}`,
    initials: cleanerInitialsFromName(item.name),
    name: item.name,
    areaLabel: item.primaryAreaLabel ?? "All areas",
    status,
    statusLabel: labelForCleanerNetworkStatus(status),
    statusTone: toneForCleanerNetworkStatus(status),
    ratingLabel: formatRatingLabel(item.averageRating),
    reviewsLabel: formatReviewsLabel(item),
    completionLabel: formatCompletionLabel(item),
    todayPrimaryLabel: formatTodayPrimaryLabel(item),
    todaySecondaryLabel: formatTodaySecondaryLabel(item),
    badgeLabels: buildBadgeLabels(item),
    activityLabel: formatActivityLabel(item, status),
  };
}

export type AdminCleanerNetworkStats = Record<AdminCleanerNetworkStatus, number>;

export function computeAdminCleanerNetworkStats(
  items: AdminCleanerListItem[],
): AdminCleanerNetworkStats {
  const stats: AdminCleanerNetworkStats = {
    available: 0,
    on_visit: 0,
    paused: 0,
    offline: 0,
  };
  for (const item of items) {
    stats[resolveCleanerNetworkStatus(item)] += 1;
  }
  return stats;
}

export function normalizeAdminCleanerNetworkViewFilter(
  param: string | undefined,
): AdminCleanerNetworkViewFilter {
  if (
    param === "available" ||
    param === "on_visit" ||
    param === "paused" ||
    param === "offline" ||
    param === "top_performers"
  ) {
    return param;
  }
  return "all";
}

export function matchesAdminCleanerNetworkViewFilter(
  item: AdminCleanerListItem,
  view: AdminCleanerNetworkViewFilter,
): boolean {
  if (view === "all") return true;
  if (view === "top_performers") return isTopPerformerCleaner(item);
  return resolveCleanerNetworkStatus(item) === view;
}

export function matchesAdminCleanerNetworkSearch(
  item: AdminCleanerListItem,
  query: string | undefined,
): boolean {
  const q = query?.trim().toLowerCase();
  if (!q || q.length < 2) return true;

  const card = buildAdminCleanerNetworkCardModel(item);
  const haystack = [
    item.name,
    item.email ?? "",
    item.phone ?? "",
    item.primaryAreaLabel ?? "",
    card.statusLabel,
    ...card.badgeLabels,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(q);
}

export function filterAdminCleanersForNetworkView(input: {
  items: AdminCleanerListItem[];
  view: AdminCleanerNetworkViewFilter;
  search?: string;
}): AdminCleanerListItem[] {
  return input.items.filter(
    (item) =>
      matchesAdminCleanerNetworkViewFilter(item, input.view) &&
      matchesAdminCleanerNetworkSearch(item, input.search),
  );
}
