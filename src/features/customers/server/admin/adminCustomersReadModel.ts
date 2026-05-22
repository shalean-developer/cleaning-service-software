import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import type { Json, PaymentStatus } from "@/lib/database/types";
import { isSeriesLinkedAdminBooking } from "@/features/dashboards/server/adminBookingRecurring";
import { PRICING_FREQUENCIES, type PricingFrequency } from "@/features/pricing/server/types";
import { resolveCustomerEmailOrNull } from "@/features/notifications/server/resolveCustomerEmailOrNull";
import { resolveCustomerEmailsOrNull } from "@/features/notifications/server/resolveCustomerEmailOrNull";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { formatLocationName } from "@/features/locations/locationDisplay";
import { parseBookingDisplay } from "@/features/dashboards/server/parseBookingDisplay";
import {
  isProvisioningHealthy,
  resolveCustomerDomainHealth,
} from "./customerDomainHealth";
import {
  activityCreatedAtGte,
  applyAdminCustomersListFilters,
  computeLastActivityAt,
  requiresInMemoryListPipeline,
} from "./adminCustomersListFilters";
import { isEmailLikeCustomerSearch } from "./isEmailLikeCustomerSearch";
import {
  ADMIN_CUSTOMERS_SEARCH_SCAN_CAP,
  escapeAdminCustomerIlikePattern,
  encodePostgrestOrLiteral,
  type ParsedAdminCustomersQuery,
} from "./parseAdminCustomersQuery";
import {
  buildAdminCustomerBookingOperationsSummary,
  buildAdminCustomerPaymentSupportSummary,
} from "./adminCustomerBookingOperations";
import type {
  AdminCustomerBookingHistoryItem,
  AdminCustomerDetail,
  AdminCustomerLatestBooking,
  AdminCustomerLifecycleSummary,
  AdminCustomerListItem,
  AdminCustomerPaymentHistoryItem,
  AdminCustomerPaymentSummary,
  AdminCustomersListResult,
} from "./types";

const ADMIN_CUSTOMER_BOOKINGS_LIMIT = 100;
const ADMIN_CUSTOMER_PAYMENTS_LIMIT = 100;
const EMAIL_RESOLVE_CONCURRENCY = 10;

type CustomerRowSlice = {
  id: string;
  profile_id: string;
  company_name: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileRowSlice = {
  id: string;
  role: "customer" | "admin" | "cleaner";
  full_name: string | null;
  created_at: string;
};

type BookingRowSlice = {
  id: string;
  customer_id: string;
  cleaner_id: string | null;
  status: string;
  scheduled_start: string;
  scheduled_end: string;
  price_cents: number;
  currency: string;
  series_id: string | null;
  metadata: Json;
  created_at: string;
};

type BookingListRowSlice = {
  id: string;
  customer_id: string;
  status: string;
  scheduled_start: string;
  price_cents: number;
  created_at: string;
  series_id: string | null;
  metadata: Json;
};

type BookingListSummary = {
  bookingCount: number;
  recurringCount: number;
  latestBooking: AdminCustomerLatestBooking | null;
  areaLabel: string | null;
  lifetimeValueCents: number;
  lastVisitAt: string | null;
  preferredCleanerId: string | null;
};

type PaymentRowSlice = {
  id: string;
  booking_id: string;
  status: PaymentStatus;
  amount_cents: number;
  currency: string;
  provider: string;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

function asRecord(metadata: Json | null | undefined): Record<string, unknown> {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  return metadata as Record<string, unknown>;
}

function readBookingFrequency(metadata: Json): PricingFrequency {
  const record = asRecord(metadata);
  const raw =
    (typeof record.frequency === "string" ? record.frequency : null) ??
    (typeof record.quote === "object" &&
    record.quote !== null &&
    !Array.isArray(record.quote) &&
    typeof (record.quote as Record<string, unknown>).frequency === "string"
      ? ((record.quote as Record<string, unknown>).frequency as string)
      : null);
  if (raw && (PRICING_FREQUENCIES as readonly string[]).includes(raw)) {
    return raw as PricingFrequency;
  }
  return "once";
}

function isRecurringBooking(
  booking: Pick<BookingListRowSlice | BookingRowSlice, "series_id">,
): boolean {
  return isSeriesLinkedAdminBooking(booking.series_id);
}

function displayCompanyName(
  companyName: string | null,
  profileName: string | null,
  customerId: string,
): string {
  const company = companyName?.trim();
  if (company) return company;
  const name = profileName?.trim();
  if (name) return name;
  return `Customer ${customerId.slice(0, 8)}`;
}

function emptyPaymentSummary(): AdminCustomerPaymentSummary {
  return {
    totalPayments: 0,
    paidCount: 0,
    pendingCount: 0,
    failedCount: 0,
    refundedCount: 0,
    totalPaidCents: 0,
  };
}

function buildPaymentSummary(payments: PaymentRowSlice[]): AdminCustomerPaymentSummary {
  const summary = emptyPaymentSummary();
  for (const payment of payments) {
    summary.totalPayments += 1;
    if (payment.status === "paid") {
      summary.paidCount += 1;
      summary.totalPaidCents += payment.amount_cents;
    } else if (payment.status === "pending" || payment.status === "initialized") {
      summary.pendingCount += 1;
    } else if (payment.status === "failed") {
      summary.failedCount += 1;
    } else if (payment.status === "refunded") {
      summary.refundedCount += 1;
    }
  }
  return summary;
}

function buildLifecycleSummary(bookings: BookingRowSlice[]): AdminCustomerLifecycleSummary {
  const summary: AdminCustomerLifecycleSummary = {
    totalBookings: bookings.length,
    draftCount: 0,
    confirmedCount: 0,
    completedCount: 0,
    cancelledCount: 0,
    otherCount: 0,
  };

  for (const booking of bookings) {
    switch (booking.status) {
      case "draft":
        summary.draftCount += 1;
        break;
      case "confirmed":
      case "assigned":
      case "in_progress":
        summary.confirmedCount += 1;
        break;
      case "completed":
        summary.completedCount += 1;
        break;
      case "cancelled":
        summary.cancelledCount += 1;
        break;
      default:
        summary.otherCount += 1;
    }
  }

  return summary;
}

function pickLatestFromListRows(
  bookings: BookingListRowSlice[],
): AdminCustomerLatestBooking | null {
  if (bookings.length === 0) return null;
  const sorted = [...bookings].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const latest = sorted[0]!;
  const display = parseBookingDisplay(latest.metadata);
  return {
    id: latest.id,
    status: latest.status,
    scheduledStart: latest.scheduled_start,
    createdAt: latest.created_at,
    serviceLabel: display.serviceLabel,
  };
}

function latestPaymentByBookingId(
  payments: PaymentRowSlice[],
): Map<string, PaymentRowSlice> {
  const byBooking = new Map<string, PaymentRowSlice>();
  for (const payment of payments) {
    const existing = byBooking.get(payment.booking_id);
    if (
      !existing ||
      new Date(payment.updated_at).getTime() > new Date(existing.updated_at).getTime()
    ) {
      byBooking.set(payment.booking_id, payment);
    }
  }
  return byBooking;
}

async function resolveCleanerLabelsById(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  cleanerIds: string[],
): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  const uniqueIds = [...new Set(cleanerIds.filter(Boolean))];
  if (uniqueIds.length === 0) return labels;

  const { data: cleaners, error } = await client
    .from("cleaners")
    .select("id, profile_id")
    .in("id", uniqueIds);

  if (error) throw new Error(error.message);

  const profileIds = (cleaners ?? [])
    .map((c) => c.profile_id)
    .filter((id): id is string => Boolean(id));

  const profileNames = new Map<string, string>();
  if (profileIds.length > 0) {
    const { data: profiles, error: profileError } = await client
      .from("profiles")
      .select("id, full_name")
      .in("id", profileIds);
    if (profileError) throw new Error(profileError.message);
    for (const profile of profiles ?? []) {
      profileNames.set(profile.id, profile.full_name?.trim() || profile.id.slice(0, 8));
    }
  }

  for (const cleaner of cleaners ?? []) {
    const name = profileNames.get(cleaner.profile_id);
    labels.set(cleaner.id, name ?? `Cleaner ${cleaner.id.slice(0, 8)}`);
  }

  return labels;
}

function mapBookingHistoryItem(
  booking: BookingRowSlice,
  input: {
    paymentStatus: PaymentStatus | null;
    assignedCleanerLabel: string | null;
  },
): AdminCustomerBookingHistoryItem {
  const display = parseBookingDisplay(booking.metadata);
  return {
    id: booking.id,
    status: booking.status,
    scheduledStart: booking.scheduled_start,
    scheduledEnd: booking.scheduled_end,
    priceCents: booking.price_cents,
    currency: booking.currency,
    isRecurring: isRecurringBooking(booking),
    frequencyLabel: display.frequencyLabel,
    serviceLabel: display.serviceLabel,
    seriesId: booking.series_id,
    createdAt: booking.created_at,
    paymentStatus: input.paymentStatus,
    assignedCleanerLabel: input.assignedCleanerLabel,
    bookingReference: booking.id.slice(0, 8),
  };
}

function pickMostRecentVisitRow(rows: BookingListRowSlice[]): BookingListRowSlice | null {
  const completed = rows.filter((row) => row.status === "completed");
  const pool = completed.length > 0 ? completed : rows;
  if (pool.length === 0) return null;
  return [...pool].sort(
    (a, b) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime(),
  )[0]!;
}

function aggregateBookingListSummary(rows: BookingListRowSlice[]): BookingListSummary {
  let recurringCount = 0;
  let lifetimeValueCents = 0;

  for (const row of rows) {
    if (isRecurringBooking(row)) recurringCount += 1;
    if (row.status === "completed") {
      lifetimeValueCents += row.price_cents;
    }
  }

  const visitRow = pickMostRecentVisitRow(rows);
  let areaLabel: string | null = null;
  let preferredCleanerId: string | null = null;
  let lastVisitAt: string | null = null;

  if (visitRow) {
    const display = parseBookingDisplay(visitRow.metadata);
    const suburbRaw = display.suburb?.trim();
    areaLabel =
      (suburbRaw ? formatLocationName(suburbRaw) : null) ||
      display.city?.trim() ||
      (display.locationSummary !== "-" ? display.locationSummary : null);
    preferredCleanerId = display.preferredCleanerId;
    lastVisitAt = visitRow.scheduled_start;
  }

  return {
    bookingCount: rows.length,
    recurringCount,
    latestBooking: pickLatestFromListRows(rows),
    areaLabel,
    lifetimeValueCents,
    lastVisitAt,
    preferredCleanerId,
  };
}

async function findProfileIdsByEmailSearch(needle: string): Promise<string[]> {
  const normalized = needle.trim().toLowerCase();
  if (!normalized) return [];

  let authClient: ReturnType<typeof requireServiceRoleClient>;
  try {
    authClient = requireServiceRoleClient();
  } catch {
    return [];
  }

  const profileIds: string[] = [];
  let page = 1;
  for (;;) {
    const { data, error } = await authClient.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);

    for (const user of data.users ?? []) {
      if (user.id && user.email?.toLowerCase().includes(normalized)) {
        profileIds.push(user.id);
      }
    }

    if ((data.users ?? []).length < 200) break;
    page += 1;
    if (profileIds.length >= ADMIN_CUSTOMERS_SEARCH_SCAN_CAP) break;
  }

  return [...new Set(profileIds)];
}

function applyCreatedAtFloorToCustomerQuery<
  T extends { gte: (column: string, value: string) => T },
>(builder: T, query: ParsedAdminCustomersQuery): T {
  const createdGte = activityCreatedAtGte(query.activity);
  return createdGte ? builder.gte("created_at", createdGte) : builder;
}

async function loadCustomersForList(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  query: ParsedAdminCustomersQuery,
): Promise<{ rows: CustomerRowSlice[]; matchTotal: number; capped: boolean }> {
  const search = query.q?.trim();
  const inMemory = requiresInMemoryListPipeline(query);

  if (!search && !inMemory) {
    const from = (query.page - 1) * query.limit;
    const to = from + query.limit - 1;

    let builder = client
      .from("customers")
      .select(
        "id, profile_id, company_name, phone, notes, created_at, updated_at",
        { count: "exact" },
      )
      .order("updated_at", { ascending: false });

    builder = applyCreatedAtFloorToCustomerQuery(builder, query);

    const { data, error, count } = await builder.range(from, to);

    if (error) throw new Error(error.message);

    return {
      rows: (data ?? []) as CustomerRowSlice[],
      matchTotal: count ?? 0,
      capped: false,
    };
  }

  if (!search && inMemory) {
    let builder = client
      .from("customers")
      .select("id, profile_id, company_name, phone, notes, created_at, updated_at")
      .order("updated_at", { ascending: false });

    builder = applyCreatedAtFloorToCustomerQuery(builder, query);

    const { data, error } = await builder.limit(ADMIN_CUSTOMERS_SEARCH_SCAN_CAP);

    if (error) throw new Error(error.message);

    const allRows = (data ?? []) as CustomerRowSlice[];
    return {
      rows: allRows,
      matchTotal: allRows.length,
      capped: allRows.length >= ADMIN_CUSTOMERS_SEARCH_SCAN_CAP,
    };
  }

  const pattern = `%${escapeAdminCustomerIlikePattern(search!)}%`;
  const orParts = [
    `company_name.ilike.${encodePostgrestOrLiteral(pattern)}`,
    `phone.ilike.${encodePostgrestOrLiteral(pattern)}`,
  ];

  if (isEmailLikeCustomerSearch(search!)) {
    const emailProfileIds = await findProfileIdsByEmailSearch(search!);
    if (emailProfileIds.length > 0) {
      orParts.push(`profile_id.in.(${emailProfileIds.join(",")})`);
    }
  }

  let searchBuilder = client
    .from("customers")
    .select("id, profile_id, company_name, phone, notes, created_at, updated_at")
    .or(orParts.join(","))
    .order("updated_at", { ascending: false });

  searchBuilder = applyCreatedAtFloorToCustomerQuery(searchBuilder, query);

  const { data: matched, error: matchError } = await searchBuilder.limit(
    ADMIN_CUSTOMERS_SEARCH_SCAN_CAP,
  );

  if (matchError) throw new Error(matchError.message);

  const allRows = (matched ?? []) as CustomerRowSlice[];
  return {
    rows: allRows,
    matchTotal: allRows.length,
    capped: allRows.length >= ADMIN_CUSTOMERS_SEARCH_SCAN_CAP,
  };
}

/** Lightweight list summaries: count, recurring count, latest booking only. */
async function loadBookingListSummariesByCustomerIds(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  customerIds: string[],
): Promise<Map<string, BookingListSummary>> {
  const summaryByCustomer = new Map<string, BookingListSummary>();
  const rowsByCustomer = new Map<string, BookingListRowSlice[]>();

  for (const id of customerIds) {
    summaryByCustomer.set(id, {
      bookingCount: 0,
      recurringCount: 0,
      latestBooking: null,
      areaLabel: null,
      lifetimeValueCents: 0,
      lastVisitAt: null,
      preferredCleanerId: null,
    });
    rowsByCustomer.set(id, []);
  }

  if (customerIds.length === 0) return summaryByCustomer;

  const chunkSize = 50;
  for (let i = 0; i < customerIds.length; i += chunkSize) {
    const chunk = customerIds.slice(i, i + chunkSize);
    const { data, error } = await client
      .from("bookings")
      .select(
        "id, customer_id, status, scheduled_start, price_cents, created_at, series_id, metadata",
      )
      .in("customer_id", chunk);

    if (error) throw new Error(error.message);

    for (const row of (data ?? []) as BookingListRowSlice[]) {
      const list = rowsByCustomer.get(row.customer_id) ?? [];
      list.push(row);
      rowsByCustomer.set(row.customer_id, list);
    }
  }

  for (const [customerId, rows] of rowsByCustomer) {
    summaryByCustomer.set(customerId, aggregateBookingListSummary(rows));
  }

  return summaryByCustomer;
}

async function loadPaymentsForCustomer(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  bookingIds: string[],
): Promise<PaymentRowSlice[]> {
  if (bookingIds.length === 0) return [];

  const chunkSize = 50;
  const payments: PaymentRowSlice[] = [];

  for (let i = 0; i < bookingIds.length; i += chunkSize) {
    const chunk = bookingIds.slice(i, i + chunkSize);
    const { data, error } = await client
      .from("payments")
      .select(
        "id, booking_id, status, amount_cents, currency, provider, metadata, created_at, updated_at",
      )
      .in("booking_id", chunk)
      .order("created_at", { ascending: false })
      .limit(ADMIN_CUSTOMER_PAYMENTS_LIMIT);

    if (error) throw new Error(error.message);
    payments.push(...((data ?? []) as PaymentRowSlice[]));
  }

  payments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return payments.slice(0, ADMIN_CUSTOMER_PAYMENTS_LIMIT);
}

function buildListItem(input: {
  row: CustomerRowSlice;
  profile: ProfileRowSlice | null;
  hasCleanersRow: boolean;
  authEmail: string | null;
  bookingSummary: BookingListSummary;
}): AdminCustomerListItem {
  const { row, profile, hasCleanersRow, authEmail, bookingSummary } = input;

  const domainHealth = resolveCustomerDomainHealth({
    profileRole: profile?.role ?? null,
    hasCustomerRow: true,
    hasCleanersRow,
  });

  const latestBooking = bookingSummary.latestBooking;

  return {
    customerId: row.id,
    profileId: row.profile_id,
    companyName: displayCompanyName(row.company_name, profile?.full_name ?? null, row.id),
    authEmail,
    phone: row.phone,
    notes: row.notes,
    profileRole: profile?.role ?? null,
    bookingCount: bookingSummary.bookingCount,
    recurringCount: bookingSummary.recurringCount,
    latestBooking,
    lastActivityAt: computeLastActivityAt({
      updatedAt: row.updated_at,
      latestBooking,
    }),
    areaLabel: bookingSummary.areaLabel,
    lifetimeValueCents: bookingSummary.lifetimeValueCents,
    lastVisitAt: bookingSummary.lastVisitAt,
    preferredCleanerId: bookingSummary.preferredCleanerId,
    preferredCleanerLabel: null,
    domainHealth,
    provisioningHealthy: isProvisioningHealthy(domainHealth),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAdminCustomers(
  user: CurrentUser,
  query: ParsedAdminCustomersQuery,
): Promise<
  | { ok: true } & AdminCustomersListResult
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

  const { rows, matchTotal, capped } = await loadCustomersForList(client, query);
  const customerIds = rows.map((r) => r.id);
  const profileIds = [...new Set(rows.map((r) => r.profile_id))];

  const [profilesResult, cleanersResult, bookingSummaries, emailsByCustomer] = await Promise.all([
    client
      .from("profiles")
      .select("id, role, full_name, created_at")
      .in("id", profileIds.length > 0 ? profileIds : ["00000000-0000-0000-0000-000000000000"]),
    client
      .from("cleaners")
      .select("profile_id")
      .in("profile_id", profileIds.length > 0 ? profileIds : ["00000000-0000-0000-0000-000000000000"]),
    loadBookingListSummariesByCustomerIds(client, customerIds),
    resolveCustomerEmailsOrNull(customerIds, EMAIL_RESOLVE_CONCURRENCY),
  ]);

  if (profilesResult.error) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: profilesResult.error.message, status: 500 };
  }
  if (cleanersResult.error) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: cleanersResult.error.message, status: 500 };
  }

  const profileById = new Map(
    (profilesResult.data ?? []).map((p) => [p.id, p as ProfileRowSlice]),
  );
  const cleanerProfileIds = new Set((cleanersResult.data ?? []).map((r) => r.profile_id));

  const builtItems = rows.map((row) =>
    buildListItem({
      row,
      profile: profileById.get(row.profile_id) ?? null,
      hasCleanersRow: cleanerProfileIds.has(row.profile_id),
      authEmail: emailsByCustomer.get(row.id) ?? null,
      bookingSummary: bookingSummaries.get(row.id) ?? {
        bookingCount: 0,
        recurringCount: 0,
        latestBooking: null,
        areaLabel: null,
        lifetimeValueCents: 0,
        lastVisitAt: null,
        preferredCleanerId: null,
      },
    }),
  );

  const preferredCleanerIds = [
    ...new Set(
      builtItems
        .map((item) => item.preferredCleanerId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const preferredCleanerLabels = await resolveCleanerLabelsById(client, preferredCleanerIds);
  for (const item of builtItems) {
    if (item.preferredCleanerId) {
      item.preferredCleanerLabel =
        preferredCleanerLabels.get(item.preferredCleanerId) ?? null;
    }
  }

  const inMemory = requiresInMemoryListPipeline(query);
  const filteredItems = inMemory
    ? applyAdminCustomersListFilters(builtItems, query)
    : builtItems;

  let items: AdminCustomerListItem[];
  let resolvedMatchTotal: number;

  if (inMemory || query.q) {
    resolvedMatchTotal = filteredItems.length;
    const from = (query.page - 1) * query.limit;
    items = filteredItems.slice(from, from + query.limit);
  } else {
    resolvedMatchTotal = matchTotal;
    items = filteredItems;
  }

  return {
    ok: true,
    items,
    page: query.page,
    limit: query.limit,
    matchTotal: resolvedMatchTotal,
    returnedCount: items.length,
    capped,
  };
}

export async function getAdminCustomerDetail(
  user: CurrentUser,
  customerId: string,
): Promise<
  | { ok: true; detail: AdminCustomerDetail }
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

  const { data: row, error } = await client
    .from("customers")
    .select("id, profile_id, company_name, phone, notes, created_at, updated_at")
    .eq("id", customerId)
    .maybeSingle();

  if (error) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: error.message, status: 500 };
  }
  if (!row) {
    return { ok: false, code: "CUSTOMER_NOT_FOUND", message: "Customer not found.", status: 404 };
  }

  const customer = row as CustomerRowSlice;

  const [profileResult, cleanerResult, bookingsResult, authEmail] = await Promise.all([
    client
      .from("profiles")
      .select("id, role, full_name, created_at")
      .eq("id", customer.profile_id)
      .maybeSingle(),
    client.from("cleaners").select("id").eq("profile_id", customer.profile_id).maybeSingle(),
    client
      .from("bookings")
      .select(
        "id, customer_id, cleaner_id, status, scheduled_start, scheduled_end, price_cents, currency, series_id, metadata, created_at",
      )
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(ADMIN_CUSTOMER_BOOKINGS_LIMIT),
    resolveCustomerEmailOrNull(customer.id),
  ]);

  if (profileResult.error) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: profileResult.error.message, status: 500 };
  }
  if (cleanerResult.error) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: cleanerResult.error.message, status: 500 };
  }
  if (bookingsResult.error) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: bookingsResult.error.message, status: 500 };
  }

  const profile = (profileResult.data as ProfileRowSlice | null) ?? null;
  const bookings = (bookingsResult.data ?? []) as BookingRowSlice[];
  const hasCleanersRow = Boolean(cleanerResult.data);

  const domainHealth = resolveCustomerDomainHealth({
    profileRole: profile?.role ?? null,
    hasCustomerRow: true,
    hasCleanersRow,
  });

  const payments = await loadPaymentsForCustomer(
    client,
    bookings.map((b) => b.id),
  );

  const paymentByBookingId = latestPaymentByBookingId(payments);
  const cleanerIds = bookings
    .map((b) => b.cleaner_id)
    .filter((id): id is string => Boolean(id));
  const cleanerLabels = await resolveCleanerLabelsById(client, cleanerIds);

  const bookingHistory = bookings.map((booking) =>
    mapBookingHistoryItem(booking, {
      paymentStatus: paymentByBookingId.get(booking.id)?.status ?? null,
      assignedCleanerLabel: booking.cleaner_id
        ? (cleanerLabels.get(booking.cleaner_id) ?? null)
        : null,
    }),
  );
  const recurringBookings = bookingHistory.filter((b) => b.isRecurring);

  const paymentHistory: AdminCustomerPaymentHistoryItem[] = payments.map((p) => ({
    id: p.id,
    bookingId: p.booking_id,
    status: p.status,
    amountCents: p.amount_cents,
    currency: p.currency,
    provider: p.provider,
    createdAt: p.created_at,
    metadata: p.metadata,
  }));

  const bookingOperations = buildAdminCustomerBookingOperationsSummary(bookingHistory);

  const detailWithoutPaymentSupport: Omit<AdminCustomerDetail, "paymentSupport"> = {
    customerId: customer.id,
    profileId: customer.profile_id,
    companyName: displayCompanyName(
      customer.company_name,
      profile?.full_name ?? null,
      customer.id,
    ),
    authEmail,
    phone: customer.phone,
    notes: customer.notes,
    profileFullName: profile?.full_name ?? null,
    profileRole: profile?.role ?? null,
    hasCleanersRow,
    bookingCount: bookings.length,
    recurringCount: recurringBookings.length,
    latestBooking: pickLatestFromListRows(bookings),
    paymentSummary: buildPaymentSummary(payments),
    lifecycleSummary: buildLifecycleSummary(bookings),
    domainHealth,
    provisioningHealthy: isProvisioningHealthy(domainHealth),
    bookings: bookingHistory,
    recurringBookings,
    payments: paymentHistory,
    bookingOperations,
    profileCreatedAt: profile?.created_at ?? null,
    customerCreatedAt: customer.created_at,
    customerUpdatedAt: customer.updated_at,
  };

  return {
    ok: true,
    detail: {
      ...detailWithoutPaymentSupport,
      paymentSupport: buildAdminCustomerPaymentSupportSummary(detailWithoutPaymentSupport),
    },
  };
}
