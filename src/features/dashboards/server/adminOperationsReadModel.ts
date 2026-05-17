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
import type { BookingStatus } from "@/features/bookings/server/types";
import { resolvePaymentFailureReason } from "@/features/bookings/server/paymentFailureDisplay";
import { buildLifecycleTimeline } from "./lifecycleTimeline";
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
  enrichBookingDisplayWithAssignmentVisibility,
  formatScheduleRange,
  formatZar,
  parseBookingDisplay,
} from "./parseBookingDisplay";
import type {
  AdminAssignmentQueueItem,
  AdminAssignmentQueueResult,
  AdminBookingDetail,
  AdminBookingListItem,
  AdminBookingsListResult,
  AdminOperationsSummary,
  OfferSummary,
} from "./types";

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
  price_cents: number;
  currency: string;
  metadata: import("@/lib/database/types").Json;
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
  const dispatchNotStarted = computeDispatchNotStarted({
    bookingStatus: row.status,
    cleanerId: row.cleaner_id,
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
    payments: paymentList,
    offers: offerRows,
    hasOpenOffer: openOffers.length > 0,
  });

  const paymentFailureReason = await loadPaymentFailureReason(client, row.id, row.status);
  const customerLabel = await resolveCustomerLabel(client, row.customer_id);
  const providerRefs = paymentList
    .map((p) => p.provider_ref)
    .filter((r): r is string => typeof r === "string");

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
    priceLabel: formatZar(row.price_cents, row.currency),
    assignmentAttention: display.assignmentVisibilityKey ?? display.assignmentAttention,
    assignmentVisibilityKey: display.assignmentVisibilityKey,
    dispatchNotStarted,
    recoveryEligible: eligibility === "eligible",
    updatedAt: row.updated_at,
    searchText: buildSearchText([row.id, customerLabel, ...providerRefs]),
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

  const { data: bookings, error } = await client
    .from("bookings")
    .select(
      "id, status, customer_id, cleaner_id, scheduled_start, scheduled_end, price_cents, currency, metadata, updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(ADMIN_BOOKINGS_LIST_LIMIT);

  if (error) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: error.message, status: 500 };
  }

  const built: (AdminBookingListItem & { searchText: string })[] = [];
  for (const row of bookings ?? []) {
    built.push(await buildAdminBookingListItem(client, row as BookingListRow));
  }

  const filtered = filterAdminBookings(built, query);

  return {
    ok: true,
    bookings: filtered,
    total: built.length,
    limit: ADMIN_BOOKINGS_LIST_LIMIT,
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

  const dispatchNotStarted = computeDispatchNotStarted({
    bookingStatus: row.status,
    cleanerId: row.cleaner_id,
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
    .select("id, cleaner_id, gross_amount_cents, payout_amount_cents, payout_status")
    .eq("booking_id", row.id);

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

  return {
    ok: true,
    booking: {
      id: row.id,
      status: row.status,
      paymentStatus: payment?.status ?? null,
      paymentFailureReason,
      customerId: row.customer_id,
      cleanerId: row.cleaner_id,
      customerLabel,
      cleanerLabel: await resolveCleanerLabel(client, row.cleaner_id),
      serviceLabel: display.serviceLabel,
      scheduleLabel: formatScheduleRange(row.scheduled_start, row.scheduled_end),
      scheduledStart: row.scheduled_start,
      priceLabel: formatZar(row.price_cents, row.currency),
      assignmentAttention: display.assignmentVisibilityKey ?? display.assignmentAttention,
      assignmentVisibilityKey: display.assignmentVisibilityKey,
      dispatchNotStarted,
      recoveryEligible: eligibility === "eligible",
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
      })),
      audits: (audits ?? []).map((a) => mapAuditRow(a)),
      operationalAudits: (operationalAuditRows ?? []).map((a: AdminOperationalAuditRow) =>
        mapAdminOperationalAuditRow(a, adminLabels.get(a.admin_profile_id) ?? null),
      ),
      paymentEvents,
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
      "id, status, customer_id, cleaner_id, scheduled_start, scheduled_end, metadata, updated_at",
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
