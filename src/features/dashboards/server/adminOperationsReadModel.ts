import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import { isOfferOpenForOps } from "@/features/assignments/server/buildOfferExpiry";
import { ASSIGNMENT_RECOVERY_GRACE_MINUTES } from "@/features/assignments/server/constants";
import { readAssignmentMetadata } from "@/features/assignments/server/assignmentMetadata";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  AdminOperationalAuditRow,
  AssignmentOfferRow,
  BookingStateAuditRow,
  PaymentRow,
} from "@/lib/database/types";
import { mapAdminOperationalAuditRow } from "@/features/admin/server/mapAdminOperationalAuditRow";
import { listNotificationsForBooking } from "@/features/notifications/server/listNotificationsForBooking";
import type { BookingStatus } from "@/features/bookings/server/types";
import { isAdminAssistedBookingMetadata } from "@/features/bookings/server/admin/adminAssistMetadata";
import { resolvePaymentFailureReason } from "@/features/bookings/server/paymentFailureDisplay";
import { buildLifecycleTimeline } from "./lifecycleTimeline";
import {
  isServerSideAssignmentFilter,
  resolveAdminAssignmentFilterSql,
} from "./adminAssignmentFilterSql";
import {
  applyAdminBookingsSearchSql,
  applyAdminBookingsSqlFilters,
  hasHonestMatchTotal,
  hasServerSideSearch,
  hasServerSideSqlFilters,
  needsInMemoryRefinement,
  normalizeAdminBookingsQuery,
  resolveAdminBookingsSearchSql,
} from "./adminBookingsListQuery";
import {
  ADMIN_BOOKINGS_EXPORT_LIMIT,
  buildBookingsExportFilename,
  mapAdminBookingListItemToCsvRow,
  renderAdminBookingsCsv,
  resolveBookingsExportScope,
} from "./adminBookingsExport";
import { locationSearchTokens } from "@/features/locations/locationDisplay";
import { isRecurringAdminBooking } from "./adminBookingRecurring";
import {
  ADMIN_ASSIGNMENT_QUEUE_LIMIT,
  ADMIN_BOOKINGS_LIST_LIMIT,
  buildAdminOperationalStatus,
  buildAssignmentQueueOpsFields,
  buildSearchText,
  computeAdminOperationsSummary,
  computeDispatchNotStarted,
  computeRecoveryEligibility,
  filterAdminBookings,
  mapAuditRow,
  resolveVisibilityForBooking,
  type AdminBookingsQuery,
} from "./adminOperationalHelpers";
import {
  computeAdminTeamSupportAnalytics,
  mapTeamSupportObservationRow,
  parseAdminOperationalLoadSignals,
  readTeamRequestFulfillment,
  readTeamSupportOps,
  supportingCleanerDisplayLabel,
  teamCoordinationStatusLabel,
  teamRequestFulfillmentLabel,
} from "./adminTeamSupportObservation";
import {
  enrichBookingDisplayWithAssignmentVisibility,
  formatScheduleRange,
  formatZar,
  parseBookingDisplay,
} from "./parseBookingDisplay";
import { resolveDeferredDispatchStatus } from "@/features/assignments/server/deferredDispatchStatus";
import { assessBookingHardDeleteEligibility } from "@/features/admin/server/entityArchive/bookingHardDeleteQueries";
import { listTeamRosterFoundationForBooking } from "./bookingCleanersReadModel";
import { reconcileTeamEarningsForBooking } from "@/features/earnings/server/teamEarningsReconciliation";
import {
  formatZaMobileForDisplay,
  normalizeZaMobilePhone,
} from "@/lib/validation/zaPhone";
import type {
  AdminAssignmentQueueItem,
  AdminAssignmentQueueResult,
  AdminBookingDetail,
  AdminBookingListItem,
  AdminBookingObservation,
  AdminBookingsListResult,
  AdminOperationsSummary,
  AdminTeamSupportAnalytics,
  OfferSummary,
} from "./types";
import type { Json } from "@/lib/database/types";
import type { BookingDisplayFields } from "./parseBookingDisplay";

const ADMIN_TEAM_SUPPORT_ANALYTICS_LIMIT = 500;

function buildAdminBookingObservation(
  metadata: Json | null | undefined,
  display: Pick<BookingDisplayFields, "isTwoCleanerRequest" | "serviceSlug">,
): AdminBookingObservation {
  const teamSupportOps = readTeamSupportOps(metadata);
  const teamRequestFulfillment = readTeamRequestFulfillment(metadata);
  const isTwoCleanerRequest = display.isTwoCleanerRequest;

  return {
    isTwoCleanerRequest,
    operationalLoad: parseAdminOperationalLoadSignals(metadata, display.serviceSlug),
    teamRequestFulfillment,
    teamRequestFulfillmentLabel: teamRequestFulfillmentLabel(
      teamRequestFulfillment,
      isTwoCleanerRequest,
    ),
    teamSupportOps,
    supportingCleanerLabel: supportingCleanerDisplayLabel(teamSupportOps.supportingCleaner),
    coordinationStatusLabel: teamCoordinationStatusLabel(
      teamSupportOps.coordinationStatus,
      isTwoCleanerRequest,
    ),
    hasTeamSupportNotes: teamSupportOps.teamSupportNotes != null,
  };
}

async function resolveCustomerLabel(
  client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  customerId: string,
): Promise<string> {
  if (!client) return customerId.slice(0, 8);
  const { data } = await client
    .from("customers")
    .select("company_name")
    .eq("id", customerId)
    .maybeSingle();
  return data?.company_name?.trim() || `Customer ${customerId.slice(0, 8)}`;
}

async function resolveCustomerPhone(
  client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  customerId: string,
  metadata: import("@/lib/database/types").Json | null | undefined,
): Promise<{ e164: string | null; display: string | null }> {
  let e164: string | null = null;
  if (client) {
    const { data } = await client
      .from("customers")
      .select("phone")
      .eq("id", customerId)
      .maybeSingle();
    e164 = normalizeZaMobilePhone(data?.phone);
  }
  if (!e164) {
    e164 = parseBookingDisplay(metadata).contactPhone;
  }
  return { e164, display: formatZaMobileForDisplay(e164) };
}

async function resolveCleanerLabel(
  client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  cleanerId: string | null,
): Promise<string | null> {
  if (!cleanerId || !client) return null;
  const { data: cleaner } = await client
    .from("cleaners")
    .select("profile_id")
    .eq("id", cleanerId)
    .maybeSingle();
  if (!cleaner) return `Cleaner ${cleanerId.slice(0, 8)}`;
  const { data: profile } = await client
    .from("profiles")
    .select("full_name")
    .eq("id", cleaner.profile_id)
    .maybeSingle();
  return profile?.full_name?.trim() || `Cleaner ${cleanerId.slice(0, 8)}`;
}

function latestPayment(payments: PaymentRow[]): PaymentRow | null {
  if (!payments.length) return null;
  return [...payments].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]!;
}

async function loadPaymentFailureReason(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  bookingId: string,
  status: BookingStatus,
): Promise<string | null> {
  if (status !== "payment_failed") return null;
  const { data: audits } = await client
    .from("booking_state_audit")
    .select("command, metadata, created_at")
    .eq("booking_id", bookingId)
    .eq("command", "MARK_PAYMENT_FAILED")
    .order("created_at", { ascending: false })
    .limit(5);
  return resolvePaymentFailureReason((audits ?? []) as BookingStateAuditRow[]);
}

async function mapOffers(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  offers: AssignmentOfferRow[],
): Promise<OfferSummary[]> {
  const mapped: OfferSummary[] = [];
  for (const offer of offers) {
    mapped.push({
      id: offer.id,
      cleanerId: offer.cleaner_id,
      cleanerName: await resolveCleanerLabel(client, offer.cleaner_id),
      status: offer.status,
      offeredAt: offer.offered_at,
      expiresAt: offer.expires_at,
      respondedAt: offer.responded_at,
    });
  }
  return mapped;
}

type BookingListRow = {
  id: string;
  status: BookingStatus;
  customer_id: string;
  cleaner_id: string | null;
  scheduled_start: string;
  scheduled_end: string;
  assignment_dispatch_at: string | null;
  price_cents: number;
  currency: string;
  series_id: string | null;
  metadata: import("@/lib/database/types").Json;
  created_at: string;
  updated_at: string;
};

async function buildAdminBookingListItem(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  row: BookingListRow,
): Promise<
  AdminBookingListItem & {
    searchText: string;
  }
> {
  const { data: payments } = await client.from("payments").select("*").eq("booking_id", row.id);
  const paymentList = payments ?? [];
  const payment = latestPayment(paymentList);

  const { data: offers } = await client
    .from("assignment_offers")
    .select("status, expires_at")
    .eq("booking_id", row.id);

  const offerRows = offers ?? [];
  const openOffers = offerRows.filter((o) => isOfferOpenForOps(o));
  const deferredDispatch = resolveDeferredDispatchStatus({
    bookingStatus: row.status,
    assignmentDispatchAt: row.assignment_dispatch_at,
    scheduledStart: row.scheduled_start,
    hasOpenOffer: openOffers.length > 0,
    hasAcceptedOffer: offerRows.some((o) => o.status === "accepted"),
    hasCleaner: Boolean(row.cleaner_id),
  });
  const dispatchNotStarted = computeDispatchNotStarted({
    bookingStatus: row.status,
    cleanerId: row.cleaner_id,
    assignmentDispatchAt: row.assignment_dispatch_at,
    assignmentReason: readAssignmentMetadata(row.metadata)?.reason,
    payments: paymentList,
    offers: offerRows,
  });

  let display = parseBookingDisplay(row.metadata);
  if (row.status === "pending_assignment" || row.status === "confirmed") {
    display = enrichBookingDisplayWithAssignmentVisibility(display, {
      bookingStatus: row.status,
      metadata: row.metadata,
      hasOpenOffer: openOffers.length > 0,
      offerStatuses: offerRows.map((o) => o.status),
      dispatchNotStarted,
    });
  }

  const { eligibility } = computeRecoveryEligibility({
    bookingStatus: row.status,
    cleanerId: row.cleaner_id,
    assignmentDispatchAt: row.assignment_dispatch_at,
    payments: paymentList,
    offers: offerRows,
    hasOpenOffer: openOffers.length > 0,
  });

  const paymentFailureReason = await loadPaymentFailureReason(client, row.id, row.status);
  const customerLabel = await resolveCustomerLabel(client, row.customer_id);
  const providerRefs = paymentList
    .map((p) => p.provider_ref)
    .filter((r): r is string => typeof r === "string");

  const observation = buildAdminBookingObservation(row.metadata, display);

  return {
    id: row.id,
    status: row.status,
    paymentStatus: payment?.status ?? null,
    paymentFailureReason,
    customerLabel,
    cleanerLabel: await resolveCleanerLabel(client, row.cleaner_id),
    serviceLabel: display.serviceLabel,
    scheduleLabel: formatScheduleRange(row.scheduled_start, row.scheduled_end),
    scheduledStart: row.scheduled_start,
    scheduledEnd: row.scheduled_end,
    createdAt: row.created_at,
    suburb: display.suburb,
    city: display.city,
    addressLine: display.addressLine,
    homeSizeSummary: display.homeSizeSummary,
    isRecurring: Boolean(
      isRecurringAdminBooking({
        seriesId: row.series_id,
        metadata: row.metadata,
      }),
    ),
    priceLabel: formatZar(row.price_cents, row.currency),
    priceCents: row.price_cents,
    observation,
    latestProviderRef: payment?.provider_ref ?? null,
    assignmentAttention: display.assignmentVisibilityKey ?? display.assignmentAttention,
    assignmentVisibilityKey: display.assignmentVisibilityKey,
    dispatchNotStarted,
    recoveryEligible: eligibility === "eligible",
    deferredDispatch,
    updatedAt: row.updated_at,
    searchText: buildSearchText([
      row.id,
      customerLabel,
      ...providerRefs,
      display.suburb,
      display.city,
      ...locationSearchTokens(display.suburb),
    ]),
  };
}

export async function listAdminBookings(
  user: CurrentUser,
  query: AdminBookingsQuery = {},
): Promise<
  | { ok: true } & AdminBookingsListResult
  | { ok: false; code: string; message: string; status: number }
> {
  if (user.role !== "admin") {
    return { ok: false, code: "FORBIDDEN", message: "Admins only.", status: 403 };
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return { ok: false, code: "AUTH_NOT_CONFIGURED", message: "Supabase not configured.", status: 503 };
  }

  const normalizedQuery = normalizeAdminBookingsQuery(query);
  const applySql = hasServerSideSqlFilters(normalizedQuery);
  const refineInMemory = needsInMemoryRefinement(normalizedQuery);
  const honestMatchTotal = hasHonestMatchTotal(normalizedQuery);

  let searchSql = {};
  if (hasServerSideSearch(normalizedQuery)) {
    try {
      searchSql = await resolveAdminBookingsSearchSql(client, normalizedQuery);
    } catch (searchError) {
      const message = searchError instanceof Error ? searchError.message : "Search failed.";
      return { ok: false, code: "PERSISTENCE_ERROR", message, status: 500 };
    }
  }

  let assignmentFilterSql = {};
  if (isServerSideAssignmentFilter(normalizedQuery.filter)) {
    try {
      assignmentFilterSql = await resolveAdminAssignmentFilterSql(client, normalizedQuery.filter);
    } catch (assignmentFilterError) {
      const message =
        assignmentFilterError instanceof Error
          ? assignmentFilterError.message
          : "Assignment filter failed.";
      return { ok: false, code: "PERSISTENCE_ERROR", message, status: 500 };
    }
  }

  const bookingColumns =
    "id, status, customer_id, cleaner_id, scheduled_start, scheduled_end, assignment_dispatch_at, price_cents, currency, series_id, metadata, created_at, updated_at";

  let listQuery = client.from("bookings").select(bookingColumns);
  if (applySql) {
    listQuery = applyAdminBookingsSqlFilters(listQuery, normalizedQuery, assignmentFilterSql);
    listQuery = applyAdminBookingsSearchSql(listQuery, searchSql);
  }
  listQuery = listQuery.order("updated_at", { ascending: false }).limit(ADMIN_BOOKINGS_LIST_LIMIT);

  const countPromise = honestMatchTotal
    ? (() => {
        let countQuery = client.from("bookings").select("*", { count: "exact", head: true });
        countQuery = applyAdminBookingsSqlFilters(countQuery, normalizedQuery, assignmentFilterSql);
        countQuery = applyAdminBookingsSearchSql(countQuery, searchSql);
        return countQuery;
      })()
    : null;

  const [{ data: bookings, error }, countResult] = await Promise.all([
    listQuery,
    countPromise ?? Promise.resolve({ count: null, error: null }),
  ]);

  if (error) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: error.message, status: 500 };
  }
  if (countResult.error) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: countResult.error.message,
      status: 500,
    };
  }

  const built: (AdminBookingListItem & { searchText: string })[] = [];
  for (const row of bookings ?? []) {
    built.push(await buildAdminBookingListItem(client, row as BookingListRow));
  }

  const filtered = refineInMemory ? filterAdminBookings(built, normalizedQuery) : built;
  const returnedCount = filtered.length;
  const matchTotal = honestMatchTotal ? (countResult.count ?? 0) : null;
  const capped =
    matchTotal !== null
      ? matchTotal > returnedCount
      : returnedCount >= ADMIN_BOOKINGS_LIST_LIMIT;

  return {
    ok: true,
    bookings: filtered,
    matchTotal,
    returnedCount,
    limit: ADMIN_BOOKINGS_LIST_LIMIT,
    capped,
    subsetFiltered: refineInMemory ? true : undefined,
  };
}

export type AdminBookingsCsvExportResult =
  | {
      ok: true;
      csv: string;
      filename: string;
      returnedCount: number;
      matchTotal: number | null;
      truncated: boolean;
    }
  | { ok: false; code: string; message: string; status: number };

export function logAdminBookingsCsvExport(input: {
  adminProfileId: string;
  filter?: string;
  q?: string;
  from?: string;
  to?: string;
  returnedCount: number;
  matchTotal: number | null;
  truncated: boolean;
}): void {
  console.info(
    JSON.stringify({
      event: "admin_bookings_csv_export",
      adminProfileId: input.adminProfileId,
      filter: input.filter ?? null,
      q: input.q ? `[len=${input.q.length}]` : null,
      from: input.from ?? null,
      to: input.to ?? null,
      returnedCount: input.returnedCount,
      matchTotal: input.matchTotal,
      truncated: input.truncated,
    }),
  );
}

export async function exportAdminBookingsCsv(
  user: CurrentUser,
  query: AdminBookingsQuery = {},
): Promise<AdminBookingsCsvExportResult> {
  if (user.role !== "admin") {
    return { ok: false, code: "FORBIDDEN", message: "Admins only.", status: 403 };
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return { ok: false, code: "AUTH_NOT_CONFIGURED", message: "Supabase not configured.", status: 503 };
  }

  const normalizedQuery = normalizeAdminBookingsQuery(query);
  const applySql = hasServerSideSqlFilters(normalizedQuery);
  const honestMatchTotal = hasHonestMatchTotal(normalizedQuery);

  let searchSql = {};
  if (hasServerSideSearch(normalizedQuery)) {
    try {
      searchSql = await resolveAdminBookingsSearchSql(client, normalizedQuery);
    } catch (searchError) {
      const message = searchError instanceof Error ? searchError.message : "Search failed.";
      return { ok: false, code: "PERSISTENCE_ERROR", message, status: 500 };
    }
  }

  let assignmentFilterSql = {};
  if (isServerSideAssignmentFilter(normalizedQuery.filter)) {
    try {
      assignmentFilterSql = await resolveAdminAssignmentFilterSql(client, normalizedQuery.filter);
    } catch (assignmentFilterError) {
      const message =
        assignmentFilterError instanceof Error
          ? assignmentFilterError.message
          : "Assignment filter failed.";
      return { ok: false, code: "PERSISTENCE_ERROR", message, status: 500 };
    }
  }

  const bookingColumns =
    "id, status, customer_id, cleaner_id, scheduled_start, scheduled_end, assignment_dispatch_at, price_cents, currency, series_id, metadata, created_at, updated_at";

  let listQuery = client.from("bookings").select(bookingColumns);
  if (applySql) {
    listQuery = applyAdminBookingsSqlFilters(listQuery, normalizedQuery, assignmentFilterSql);
    listQuery = applyAdminBookingsSearchSql(listQuery, searchSql);
  }
  listQuery = listQuery
    .order("updated_at", { ascending: false })
    .limit(ADMIN_BOOKINGS_EXPORT_LIMIT);

  const countPromise = honestMatchTotal
    ? (() => {
        let countQuery = client.from("bookings").select("*", { count: "exact", head: true });
        countQuery = applyAdminBookingsSqlFilters(countQuery, normalizedQuery, assignmentFilterSql);
        countQuery = applyAdminBookingsSearchSql(countQuery, searchSql);
        return countQuery;
      })()
    : null;

  const [{ data: bookings, error }, countResult] = await Promise.all([
    listQuery,
    countPromise ?? Promise.resolve({ count: null, error: null }),
  ]);

  if (error) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: error.message, status: 500 };
  }
  if (countResult.error) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: countResult.error.message,
      status: 500,
    };
  }

  const built: AdminBookingListItem[] = [];
  for (const row of bookings ?? []) {
    built.push(await buildAdminBookingListItem(client, row as BookingListRow));
  }

  const returnedCount = built.length;
  const matchTotal = honestMatchTotal ? (countResult.count ?? 0) : null;
  const truncated = matchTotal !== null ? matchTotal > returnedCount : returnedCount >= ADMIN_BOOKINGS_EXPORT_LIMIT;

  const csvRows = built.map((item) => mapAdminBookingListItemToCsvRow(item));
  const csv = renderAdminBookingsCsv(csvRows, {
    truncated: truncated && matchTotal !== null,
    returnedCount,
    matchTotal,
  });

  const scope = resolveBookingsExportScope(normalizedQuery.filter);
  const filename = buildBookingsExportFilename(scope);

  logAdminBookingsCsvExport({
    adminProfileId: user.profileId,
    filter: normalizedQuery.filter,
    q: normalizedQuery.search,
    from: normalizedQuery.scheduledFrom,
    to: normalizedQuery.scheduledTo,
    returnedCount,
    matchTotal,
    truncated,
  });

  return {
    ok: true,
    csv,
    filename,
    returnedCount,
    matchTotal,
    truncated,
  };
}

export async function getAdminOperationsSummary(
  user: CurrentUser,
): Promise<
  | { ok: true; summary: AdminOperationsSummary }
  | { ok: false; code: string; message: string; status: number }
> {
  if (user.role !== "admin") {
    return { ok: false, code: "FORBIDDEN", message: "Admins only.", status: 403 };
  }

  const bookingsResult = await listAdminBookings(user);
  const queueResult = await listAdminAssignmentQueue(user);
  if (!bookingsResult.ok) {
    return {
      ok: false,
      code: bookingsResult.code,
      message: bookingsResult.message,
      status: bookingsResult.status,
    };
  }
  if (!queueResult.ok) {
    return {
      ok: false,
      code: queueResult.code,
      message: queueResult.message,
      status: queueResult.status,
    };
  }

  return {
    ok: true,
    summary: computeAdminOperationsSummary({
      bookings: bookingsResult.bookings,
      assignmentQueueTotal: queueResult.total,
      bookingsVisible: bookingsResult.bookings.length,
      assignmentQueueVisible: queueResult.items.length,
    }),
  };
}

export async function getAdminBookingDetail(
  user: CurrentUser,
  bookingId: string,
): Promise<
  | { ok: true; booking: AdminBookingDetail }
  | { ok: false; code: string; message: string; status: number }
> {
  if (user.role !== "admin") {
    return { ok: false, code: "FORBIDDEN", message: "Admins only.", status: 403 };
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return { ok: false, code: "AUTH_NOT_CONFIGURED", message: "Supabase not configured.", status: 503 };
  }

  const { data: row, error } = await client
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: error.message, status: 500 };
  }
  if (!row) {
    return { ok: false, code: "NOT_FOUND", message: "Booking not found.", status: 404 };
  }

  const { data: payments } = await client.from("payments").select("*").eq("booking_id", row.id);
  const { data: offers } = await client
    .from("assignment_offers")
    .select("*")
    .eq("booking_id", row.id)
    .order("offered_at", { ascending: false });
  const { data: audits } = await client
    .from("booking_state_audit")
    .select("*")
    .eq("booking_id", row.id)
    .order("created_at", { ascending: true });

  const { data: operationalAuditRows } = await client
    .from("admin_operational_audit")
    .select("*")
    .eq("booking_id", row.id)
    .order("created_at", { ascending: true });

  const adminProfileIds = [
    ...new Set((operationalAuditRows ?? []).map((a) => a.admin_profile_id)),
  ];
  const adminLabels = new Map<string, string>();
  if (adminProfileIds.length > 0) {
    const { data: adminProfiles } = await client
      .from("profiles")
      .select("id, full_name")
      .in("id", adminProfileIds);
    for (const p of adminProfiles ?? []) {
      adminLabels.set(p.id, p.full_name?.trim() || p.id.slice(0, 8));
    }
  }

  const paymentList = payments ?? [];
  const payment = latestPayment(paymentList);
  const offerRows = offers ?? [];
  const openOfferRows = offerRows.filter((o) => isOfferOpenForOps(o));

  const deferredDispatch = resolveDeferredDispatchStatus({
    bookingStatus: row.status,
    assignmentDispatchAt: row.assignment_dispatch_at,
    scheduledStart: row.scheduled_start,
    hasOpenOffer: openOfferRows.length > 0,
    hasAcceptedOffer: offerRows.some((o) => o.status === "accepted"),
    hasCleaner: Boolean(row.cleaner_id),
  });

  const dispatchNotStarted = computeDispatchNotStarted({
    bookingStatus: row.status,
    cleanerId: row.cleaner_id,
    assignmentDispatchAt: row.assignment_dispatch_at,
    assignmentReason: readAssignmentMetadata(row.metadata)?.reason,
    payments: paymentList,
    offers: offerRows,
  });

  let display = parseBookingDisplay(row.metadata);
  if (row.status === "pending_assignment" || row.status === "confirmed") {
    display = enrichBookingDisplayWithAssignmentVisibility(display, {
      bookingStatus: row.status,
      metadata: row.metadata,
      hasOpenOffer: openOfferRows.length > 0,
      offerStatuses: offerRows.map((o) => o.status),
      dispatchNotStarted,
    });
  }

  const visibility = resolveVisibilityForBooking({
    bookingStatus: row.status,
    metadata: row.metadata,
    hasOpenOffer: openOfferRows.length > 0,
    offerStatuses: offerRows.map((o) => o.status),
    dispatchNotStarted,
  });

  const assignmentMeta = readAssignmentMetadata(row.metadata);
  const paymentFailureReason = resolvePaymentFailureReason(audits ?? []);
  const mappedOffers = await mapOffers(client, offerRows);

  const { eligibility, graceMinutesRemaining } = computeRecoveryEligibility({
    bookingStatus: row.status,
    cleanerId: row.cleaner_id,
    assignmentDispatchAt: row.assignment_dispatch_at,
    payments: paymentList,
    offers: offerRows,
    hasOpenOffer: openOfferRows.length > 0,
  });

  const openOfferForReplace =
    openOfferRows.length === 1
      ? {
          offerId: openOfferRows[0]!.id,
          cleanerId: openOfferRows[0]!.cleaner_id,
          cleanerName: await resolveCleanerLabel(client, openOfferRows[0]!.cleaner_id),
        }
      : null;

  const operational = buildAdminOperationalStatus({
    bookingStatus: row.status,
    paymentStatus: payment?.status ?? null,
    paymentFailed: row.status === "payment_failed",
    paymentFailureReason,
    visibilityKey: visibility.key,
    assignmentReason: assignmentMeta?.reason ?? display.assignmentReason,
    dispatchNotStarted,
    assignmentDispatchAt: row.assignment_dispatch_at,
    opsSearching: visibility.opsSearching,
    opsAdminRequired: visibility.opsAdminRequired,
    openOfferCount: openOfferRows.length,
    totalOfferCount: offerRows.length,
    hasAssignedCleaner: Boolean(row.cleaner_id),
    hasPaidPayment: paymentList.some((p) => p.status === "paid"),
    openOfferForReplace,
    offerStatuses: offerRows.map((o) => o.status),
    lastOfferOutcome: visibility.lastOfferOutcome ?? assignmentMeta?.lastOfferOutcome ?? null,
    recoveryEligibility: eligibility,
    graceMinutesRemaining,
  });

  const { data: earningRows } = await client
    .from("earning_lines")
    .select(
      "id, cleaner_id, booking_id, amount_cents, gross_amount_cents, payout_amount_cents, payout_status, payout_batch_id, line_type, description, metadata, calculation_metadata, team_earning_role, team_earning_source, created_at",
    )
    .eq("booking_id", row.id);

  const { data: rosterRows } = await client
    .from("booking_cleaners")
    .select("*")
    .eq("booking_id", row.id);

  const teamEarningsReport = reconcileTeamEarningsForBooking({
    booking: row,
    roster: rosterRows ?? [],
    earningLines: earningRows ?? [],
  });
  const teamEarningsReconciliation = {
    enabled: teamEarningsReport.enabled,
    splitPolicy: teamEarningsReport.splitPolicy,
    expectedParticipantCount: teamEarningsReport.expectedParticipantCount,
    expectedShareCents: teamEarningsReport.expectedShareCents,
    totalPoolCents: teamEarningsReport.totalPoolCents,
    recordedPayoutCents: teamEarningsReport.recordedPayoutCents,
    status: teamEarningsReport.status,
    canMarkPayoutReady: teamEarningsReport.canMarkPayoutReady,
    blockingIssues: teamEarningsReport.blockingIssues.map((issue) => ({
      code: issue.code,
      severity: "error" as const,
      message: issue.message,
    })),
    warnings: teamEarningsReport.warnings.map((issue) => ({
      code: issue.code,
      severity: issue.severity === "info" ? ("info" as const) : ("warning" as const),
      message: issue.message,
    })),
    issues: teamEarningsReport.issues,
  };

  const paymentIds = paymentList.map((p) => p.id);
  let paymentEvents: AdminBookingDetail["paymentEvents"] = [];
  if (paymentIds.length > 0) {
    const { data: events } = await client
      .from("payment_events")
      .select("id, event_type, received_at, payment_id")
      .in("payment_id", paymentIds)
      .order("received_at", { ascending: false });
    paymentEvents = (events ?? []).map((e) => ({
      id: e.id,
      eventType: e.event_type,
      at: e.received_at,
    }));
  }

  const customerLabel = await resolveCustomerLabel(client, row.customer_id);
  const customerPhone = await resolveCustomerPhone(client, row.customer_id, row.metadata);

  const notifications = await listNotificationsForBooking(client, row.id);
  const teamRosterFoundation = await listTeamRosterFoundationForBooking(client, row.id);
  let hardDeleteEligibility: Awaited<ReturnType<typeof assessBookingHardDeleteEligibility>> = {
    hardDeleteAllowed: false,
    blockedReasons: [],
    blockers: {
      settledPaymentCount: 0,
      earningLineCount: 0,
      assignmentOfferCount: 0,
      nonTerminalOfferCount: 0,
      bookingCleanerCount: 0,
      supportRequestCount: 0,
      recurringSeriesCount: 0,
      recurringGroupAnchorCount: 0,
      hasAssignedCleaner: false,
      hasSeriesId: false,
      isSyntheticAnchor: false,
      isBlockedLifecycleStatus: false,
      lifecycleStatus: row.status,
    },
  };
  try {
    hardDeleteEligibility = await assessBookingHardDeleteEligibility(client, row);
  } catch {
    hardDeleteEligibility = {
      ...hardDeleteEligibility,
      blockedReasons: ["Could not verify hard-delete eligibility."],
    };
  }

  return {
    ok: true,
    booking: {
      id: row.id,
      status: row.status,
      paymentStatus: payment?.status ?? null,
      paymentFailureReason,
      customerId: row.customer_id,
      adminAssistedDraft: isAdminAssistedBookingMetadata(row.metadata),
      cleanerId: row.cleaner_id,
      customerLabel,
      customerPhone: customerPhone.display,
      customerPhoneE164: customerPhone.e164,
      cleanerLabel: await resolveCleanerLabel(client, row.cleaner_id),
      serviceLabel: display.serviceLabel,
      scheduleLabel: formatScheduleRange(row.scheduled_start, row.scheduled_end),
      scheduledStart: row.scheduled_start,
      priceLabel: formatZar(row.price_cents, row.currency),
      priceCents: row.price_cents,
      observation: buildAdminBookingObservation(row.metadata, display),
      assignmentAttention: display.assignmentVisibilityKey ?? display.assignmentAttention,
      assignmentVisibilityKey: display.assignmentVisibilityKey,
      dispatchNotStarted,
      recoveryEligible: eligibility === "eligible",
      deferredDispatch,
      updatedAt: row.updated_at,
      display,
      operational,
      timeline: buildLifecycleTimeline({
        bookingStatus: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        payments: paymentList,
        audits: audits ?? [],
        paymentFailureReason,
      }),
      payments: paymentList.map((p) => ({
        id: p.id,
        status: p.status,
        amountCents: p.amount_cents,
        currency: p.currency,
        provider: p.provider,
        providerRef: p.provider_ref,
      })),
      offers: mappedOffers,
      earnings: (earningRows ?? []).map((e) => ({
        id: e.id,
        cleanerId: e.cleaner_id,
        payoutAmountCents: e.payout_amount_cents,
        grossAmountCents: e.gross_amount_cents,
        payoutStatus: e.payout_status,
        lineType: e.line_type,
        teamEarningRole: e.team_earning_role,
        teamEarningSource: e.team_earning_source,
      })),
      teamEarningsReconciliation,
      audits: (audits ?? []).map((a) => mapAuditRow(a)),
      operationalAudits: (operationalAuditRows ?? []).map((a: AdminOperationalAuditRow) =>
        mapAdminOperationalAuditRow(a, adminLabels.get(a.admin_profile_id) ?? null),
      ),
      paymentEvents,
      notifications,
      teamRosterFoundation,
      deletedAt: row.deleted_at ?? null,
      hasEarningLines: (earningRows ?? []).length > 0,
      hardDelete: {
        allowed: hardDeleteEligibility.hardDeleteAllowed,
        blockedReasons: hardDeleteEligibility.blockedReasons,
      },
    },
  };
}

export async function listAdminAssignmentQueue(
  user: CurrentUser,
): Promise<
  | { ok: true } & AdminAssignmentQueueResult
  | { ok: false; code: string; message: string; status: number }
> {
  if (user.role !== "admin") {
    return { ok: false, code: "FORBIDDEN", message: "Admins only.", status: 403 };
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return { ok: false, code: "AUTH_NOT_CONFIGURED", message: "Supabase not configured.", status: 503 };
  }

  const { data: bookings, error } = await client
    .from("bookings")
    .select(
      "id, status, customer_id, cleaner_id, scheduled_start, scheduled_end, assignment_dispatch_at, metadata, updated_at",
    )
    .in("status", ["pending_assignment", "confirmed"])
    .order("updated_at", { ascending: false })
    .limit(ADMIN_ASSIGNMENT_QUEUE_LIMIT);

  if (error) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: error.message, status: 500 };
  }

  const items: AdminAssignmentQueueItem[] = [];

  for (const row of bookings ?? []) {
    const display = parseBookingDisplay(row.metadata);

    const { data: offers } = await client
      .from("assignment_offers")
      .select("*")
      .eq("booking_id", row.id);

    const { data: payments } = await client
      .from("payments")
      .select("id, status, updated_at, created_at")
      .eq("booking_id", row.id);

    const offerRows = offers ?? [];
    const openOffers = offerRows.filter((o) => isOfferOpenForOps(o));

    const dispatchNotStarted = computeDispatchNotStarted({
      bookingStatus: row.status,
      cleanerId: row.cleaner_id,
      assignmentDispatchAt: row.assignment_dispatch_at,
      assignmentReason: display.assignmentReason,
      payments: payments ?? [],
      offers: offerRows,
    });

    const needsAttention =
      display.assignmentAttention === "attention_required" ||
      row.status === "pending_assignment" ||
      dispatchNotStarted;

    if (!needsAttention && row.status !== "pending_assignment") continue;

    if (
      display.assignmentAttention !== "attention_required" &&
      !dispatchNotStarted &&
      openOffers.length === 0 &&
      row.status !== "pending_assignment"
    ) {
      continue;
    }

    const visibility = resolveVisibilityForBooking({
      bookingStatus: row.status,
      metadata: row.metadata,
      hasOpenOffer: openOffers.length > 0,
      offerStatuses: offerRows.map((o) => o.status),
      dispatchNotStarted,
    });

    const assignmentAttention =
      visibility.key ??
      (dispatchNotStarted ? "dispatch_not_started" : display.assignmentAttention ?? "pending_assignment");

    const opsFields = buildAssignmentQueueOpsFields({
      bookingStatus: row.status,
      assignmentAttention,
      assignmentReason: display.assignmentReason,
      dispatchNotStarted,
      visibilityKey: visibility.key,
      opsSearching: visibility.opsSearching,
      opsAdminRequired: visibility.opsAdminRequired,
    });

    items.push({
      bookingId: row.id,
      status: row.status,
      customerLabel: await resolveCustomerLabel(client, row.customer_id),
      serviceLabel: display.serviceLabel,
      scheduleLabel: formatScheduleRange(row.scheduled_start, row.scheduled_end),
      assignmentAttention,
      assignmentReason: display.assignmentReason,
      openOffers: await mapOffers(client, openOffers),
      updatedAt: row.updated_at,
      ...opsFields,
    });
  }

  return {
    ok: true,
    items,
    total: items.length,
    limit: ADMIN_ASSIGNMENT_QUEUE_LIMIT,
  };
}

export async function getAdminTeamSupportAnalytics(
  user: CurrentUser,
): Promise<
  | { ok: true; analytics: AdminTeamSupportAnalytics }
  | { ok: false; code: string; message: string; status: number }
> {
  if (user.role !== "admin") {
    return { ok: false, code: "FORBIDDEN", message: "Admins only.", status: 403 };
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return {
      ok: false,
      code: "AUTH_NOT_CONFIGURED",
      message: "Supabase not configured.",
      status: 503,
    };
  }

  const { data: bookings, error } = await client
    .from("bookings")
    .select("id, price_cents, metadata")
    .order("created_at", { ascending: false })
    .limit(ADMIN_TEAM_SUPPORT_ANALYTICS_LIMIT);

  if (error) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: error.message, status: 500 };
  }

  const rows = (bookings ?? []).map((row) =>
    mapTeamSupportObservationRow({
      bookingId: row.id,
      priceCents: row.price_cents,
      metadata: row.metadata,
    }),
  );

  return {
    ok: true,
    analytics: computeAdminTeamSupportAnalytics(rows, ADMIN_TEAM_SUPPORT_ANALYTICS_LIMIT),
  };
}
