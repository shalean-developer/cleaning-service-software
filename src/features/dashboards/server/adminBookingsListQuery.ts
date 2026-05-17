import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminBookingsQuery, AdminBookingFilter } from "./adminOperationalHelpers";
import {
  applyAdminAssignmentFilterSql,
  isServerSideAssignmentFilter,
  type AdminAssignmentFilterSql,
} from "./adminAssignmentFilterSql";

const SCHEDULE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const MIN_ADMIN_BOOKING_SEARCH_LENGTH = 3;

/** Impossible booking id used to force zero rows when search matches nothing. */
export const ADMIN_BOOKINGS_EMPTY_SEARCH_ID = "00000000-0000-0000-0000-000000000000";

/** Filters applied in SQL before LIMIT (Stage 6C-1). */
export const SERVER_SIDE_STATUS_FILTERS = new Set<AdminBookingFilter>([
  "payment_failed",
  "pending_assignment",
]);

export type AdminBookingsSqlFilterableQuery = {
  select: (columns: string, options?: { count: "exact"; head: true }) => AdminBookingsSqlFilterableQuery;
  eq: (column: string, value: string) => AdminBookingsSqlFilterableQuery;
  gte: (column: string, value: string) => AdminBookingsSqlFilterableQuery;
  lt: (column: string, value: string) => AdminBookingsSqlFilterableQuery;
  or: (filters: string) => AdminBookingsSqlFilterableQuery;
  in: (column: string, values: string[]) => AdminBookingsSqlFilterableQuery;
  filter: (column: string, operator: string, value: string) => AdminBookingsSqlFilterableQuery;
};

export type AdminBookingsSearchSql = {
  orFilter?: string;
  forceEmpty?: boolean;
};

export function parseScheduleDateParam(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  const date = value.trim().slice(0, 10);
  if (!SCHEDULE_DATE_RE.test(date)) return undefined;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return date;
}

export function normalizeAdminBookingSearch(search?: string): string | undefined {
  const trimmed = search?.trim();
  if (!trimmed || trimmed.length < MIN_ADMIN_BOOKING_SEARCH_LENGTH) {
    return undefined;
  }
  return trimmed;
}

/** True when q is present in the URL but below the server search minimum (presentation only). */
export function isAdminBookingSearchIgnored(search?: string): boolean {
  const trimmed = search?.trim();
  return Boolean(trimmed && trimmed.length < MIN_ADMIN_BOOKING_SEARCH_LENGTH);
}

/** Escape `%`, `_`, and `\` for Postgres ILIKE patterns. */
export function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/[%_]/g, (ch) => `\\${ch}`);
}

/** True when q looks like a UUID / hex booking-id prefix (8+ hex digits). */
export function isBookingIdPrefixSearch(q: string): boolean {
  const hexDigits = q.replace(/-/g, "").replace(/[^0-9a-f]/gi, "");
  if (hexDigits.length < 8) return false;
  return /^[0-9a-f-]+$/i.test(q);
}

/** Encode a literal for PostgREST `.or()` filter strings (commas separate clauses). */
export function encodePostgrestOrLiteral(value: string): string {
  if (/[,()]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Inclusive calendar `to` date → exclusive upper bound on `scheduled_start` (UTC). */
export function scheduledToExclusiveUpper(scheduledTo: string): string {
  const [y, m, d] = scheduledTo.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + 1)).toISOString();
}

export function scheduledFromInclusiveLower(scheduledFrom: string): string {
  return `${scheduledFrom}T00:00:00.000Z`;
}

export function normalizeAdminBookingsQuery(
  query: AdminBookingsQuery = {},
): AdminBookingsQuery {
  return {
    ...query,
    search: normalizeAdminBookingSearch(query.search),
    scheduledFrom: parseScheduleDateParam(query.scheduledFrom),
    scheduledTo: parseScheduleDateParam(query.scheduledTo),
  };
}

export function hasServerSideSearch(query: AdminBookingsQuery = {}): boolean {
  return Boolean(normalizeAdminBookingsQuery(query).search);
}

export async function resolveAdminBookingsSearchSql(
  client: SupabaseClient,
  query: AdminBookingsQuery,
): Promise<AdminBookingsSearchSql> {
  const search = normalizeAdminBookingsQuery(query).search;
  if (!search) return {};

  const ilikeContains = `%${escapeIlikePattern(search)}%`;
  const orParts: string[] = [];

  if (isBookingIdPrefixSearch(search)) {
    const idPattern = `${escapeIlikePattern(search)}%`;
    orParts.push(`id.ilike.${encodePostgrestOrLiteral(idPattern)}`);
  }

  const [customersResult, paymentsResult] = await Promise.all([
    client.from("customers").select("id").ilike("company_name", ilikeContains),
    client
      .from("payments")
      .select("booking_id")
      .not("provider_ref", "is", null)
      .ilike("provider_ref", ilikeContains),
  ]);

  if (customersResult.error) {
    throw new Error(customersResult.error.message);
  }
  if (paymentsResult.error) {
    throw new Error(paymentsResult.error.message);
  }

  const customerIds = (customersResult.data ?? []).map((row) => row.id as string);
  if (customerIds.length > 0) {
    orParts.push(`customer_id.in.(${customerIds.join(",")})`);
  }

  const bookingIdsFromPayments = [
    ...new Set(
      (paymentsResult.data ?? [])
        .map((row) => row.booking_id as string)
        .filter(Boolean),
    ),
  ];
  if (bookingIdsFromPayments.length > 0) {
    orParts.push(`id.in.(${bookingIdsFromPayments.join(",")})`);
  }

  if (orParts.length === 0) {
    return { forceEmpty: true };
  }

  return { orFilter: orParts.join(",") };
}

export function applyAdminBookingsSearchSql<T extends AdminBookingsSqlFilterableQuery>(
  builder: T,
  searchSql: AdminBookingsSearchSql,
): T {
  if (searchSql.forceEmpty) {
    return builder.in("id", [ADMIN_BOOKINGS_EMPTY_SEARCH_ID]) as T;
  }
  if (searchSql.orFilter) {
    return builder.or(searchSql.orFilter) as T;
  }
  return builder;
}

export function applyAdminBookingsSqlFilters<T extends AdminBookingsSqlFilterableQuery>(
  builder: T,
  query: AdminBookingsQuery,
  assignmentSql: AdminAssignmentFilterSql = {},
): T {
  let q = builder;
  const normalized = normalizeAdminBookingsQuery(query);

  if (
    normalized.filter &&
    SERVER_SIDE_STATUS_FILTERS.has(normalized.filter)
  ) {
    q = q.eq("status", normalized.filter) as T;
  }

  if (normalized.scheduledFrom) {
    q = q.gte("scheduled_start", scheduledFromInclusiveLower(normalized.scheduledFrom)) as T;
  }

  if (normalized.scheduledTo) {
    q = q.lt("scheduled_start", scheduledToExclusiveUpper(normalized.scheduledTo)) as T;
  }

  q = applyAdminAssignmentFilterSql(q, assignmentSql);

  return q;
}

export function isServerSideAdminBookingFilter(
  filter: AdminBookingFilter | undefined,
): boolean {
  return (
    filter != null &&
    (SERVER_SIDE_STATUS_FILTERS.has(filter) || isServerSideAssignmentFilter(filter))
  );
}

export function hasServerSideSqlFilters(query: AdminBookingsQuery = {}): boolean {
  const normalized = normalizeAdminBookingsQuery(query);
  return (
    isServerSideAdminBookingFilter(normalized.filter) ||
    Boolean(normalized.scheduledFrom) ||
    Boolean(normalized.scheduledTo) ||
    Boolean(normalized.search)
  );
}

/** True when assignment presets still refine in memory after SQL (none after 6C-3d). */
export function needsInMemoryRefinement(query: AdminBookingsQuery = {}): boolean {
  if (!query.filter) return false;
  return !isServerSideAdminBookingFilter(query.filter);
}

export function hasHonestMatchTotal(query: AdminBookingsQuery = {}): boolean {
  return hasServerSideSqlFilters(query) && !needsInMemoryRefinement(query);
}
