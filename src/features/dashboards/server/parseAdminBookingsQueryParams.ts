import type { AdminBookingFilter, AdminBookingsQuery } from "./adminOperationalHelpers";

const VALID_FILTERS = new Set<AdminBookingFilter>([
  "payment_failed",
  "pending_assignment",
  "awaiting_payment",
  "payment_link_sent",
  "payment_link_expired",
  "admin_assisted_only",
  "assignment_attention",
  "dispatch_not_started",
  "selected_declined",
  "max_attempts",
  "recovery_needed",
  "two_cleaner_request",
  "operational_load",
  "team_awaiting_coordination",
  "team_fully_coordinated",
  "high_operational_load",
  "team_high_risk_combo",
]);

/** Parse `/admin/bookings` and export route query params (shared with 6C list). */
export function parseAdminBookingsQueryParams(searchParams: URLSearchParams): AdminBookingsQuery {
  const filterParam = searchParams.get("filter");
  const filter =
    filterParam && VALID_FILTERS.has(filterParam as AdminBookingFilter)
      ? (filterParam as AdminBookingFilter)
      : undefined;

  return {
    filter,
    search: searchParams.get("q") ?? undefined,
    scheduledFrom: searchParams.get("from") ?? undefined,
    scheduledTo: searchParams.get("to") ?? undefined,
  };
}

/** Build export URL preserving list filter/search params (for UI + tests). */
export function buildAdminBookingsExportHref(input: {
  filter?: string;
  search?: string;
  scheduledFrom?: string;
  scheduledTo?: string;
}): string {
  const params = new URLSearchParams();
  if (input.filter) params.set("filter", input.filter);
  if (input.search) params.set("q", input.search);
  if (input.scheduledFrom) params.set("from", input.scheduledFrom);
  if (input.scheduledTo) params.set("to", input.scheduledTo);
  const qs = params.toString();
  return qs ? `/api/admin/export/bookings.csv?${qs}` : "/api/admin/export/bookings.csv";
}
