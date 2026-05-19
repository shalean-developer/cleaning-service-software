import type { AdminCustomerListItem } from "./types";
import type { ParsedAdminCustomersQuery } from "./parseAdminCustomersQuery";

const MS_PER_DAY = 86_400_000;

export function activityCreatedAtGte(
  activity: ParsedAdminCustomersQuery["activity"],
  nowMs = Date.now(),
): string | null {
  if (activity === "created_last_7_days") {
    return new Date(nowMs - 7 * MS_PER_DAY).toISOString();
  }
  if (activity === "created_last_30_days") {
    return new Date(nowMs - 30 * MS_PER_DAY).toISOString();
  }
  return null;
}

export function activityActiveSinceGte(
  activity: ParsedAdminCustomersQuery["activity"],
  nowMs = Date.now(),
): string | null {
  if (activity === "active_last_30_days") {
    return new Date(nowMs - 30 * MS_PER_DAY).toISOString();
  }
  return null;
}

/** True when list must load a scan batch, enrich bookings, then filter/paginate in memory. */
export function requiresInMemoryListPipeline(query: ParsedAdminCustomersQuery): boolean {
  return Boolean(
    query.q ||
      query.bookings !== "all" ||
      query.health !== "all" ||
      query.activity === "active_last_30_days",
  );
}

export function computeLastActivityAt(item: Pick<
  AdminCustomerListItem,
  "updatedAt" | "latestBooking"
>): string {
  const updatedMs = new Date(item.updatedAt).getTime();
  const bookingMs = item.latestBooking
    ? new Date(item.latestBooking.createdAt).getTime()
    : 0;
  return new Date(Math.max(updatedMs, bookingMs)).toISOString();
}

export function matchesBookingsFilter(
  item: Pick<AdminCustomerListItem, "bookingCount">,
  bookings: ParsedAdminCustomersQuery["bookings"],
): boolean {
  if (bookings === "all") return true;
  if (bookings === "has_bookings") return item.bookingCount > 0;
  return item.bookingCount === 0;
}

export function matchesHealthFilter(
  item: Pick<AdminCustomerListItem, "provisioningHealthy" | "domainHealth">,
  health: ParsedAdminCustomersQuery["health"],
): boolean {
  if (health === "all") return true;
  if (health === "healthy") return item.provisioningHealthy;
  return !item.provisioningHealthy || item.domainHealth.code !== "HEALTHY";
}

export function matchesActivityFilter(
  item: AdminCustomerListItem,
  activity: ParsedAdminCustomersQuery["activity"],
  nowMs = Date.now(),
): boolean {
  if (activity === "all") return true;

  const createdGte = activityCreatedAtGte(activity, nowMs);
  if (createdGte) {
    return item.createdAt >= createdGte;
  }

  const activeGte = activityActiveSinceGte(activity, nowMs);
  if (activeGte) {
    return computeLastActivityAt(item) >= activeGte;
  }

  return true;
}

export function applyAdminCustomersListFilters(
  items: AdminCustomerListItem[],
  query: ParsedAdminCustomersQuery,
  nowMs = Date.now(),
): AdminCustomerListItem[] {
  return items.filter(
    (item) =>
      matchesBookingsFilter(item, query.bookings) &&
      matchesHealthFilter(item, query.health) &&
      matchesActivityFilter(item, query.activity, nowMs),
  );
}
