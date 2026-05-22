import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssignmentOfferStatus, Json } from "@/lib/database/types";
import type { BookingStatus } from "@/features/bookings/server/types";
import { readAssignmentMetadata } from "@/features/assignments/server/assignmentMetadata";
import { isOfferOpenForOps } from "@/features/assignments/server/buildOfferExpiry";
import { ASSIGNMENT_RECOVERY_GRACE_MINUTES } from "@/features/assignments/server/constants";
import { isDispatchNotStartedAttentionReason } from "@/features/assignments/server/isAssignmentRecoveryCandidate";
import { resolveAssignmentVisibility } from "@/features/assignments/server/resolveAssignmentVisibility";
import {
  computeDispatchNotStarted,
  matchesAdminBookingFilter,
} from "./adminOperationalHelpers";
import type { AdminBookingFilter } from "./adminOperationalHelpers";
import {
  encodePostgrestOrLiteral,
  escapeIlikePattern,
} from "./adminBookingsListQuery";

/** Mirrors `isMaxAttemptsReason` in resolveAssignmentVisibility.ts */
export const MAX_ATTEMPTS_REASON_FRAGMENT = "maximum assignment dispatch attempts";

/** Mirrors `isDispatchNotStartedAttentionReason` substring check. */
export const DISPATCH_NOT_STARTED_REASON_FRAGMENT = "dispatch not started";

export const SERVER_SIDE_ASSIGNMENT_FILTERS = new Set<AdminBookingFilter>([
  "max_attempts",
  "selected_declined",
  "dispatch_not_started",
  "recovery_needed",
  "assignment_attention",
]);

/** Filters sharing Branch A (reason ILIKE) + Branch B (recovery candidate ids). */
export const DISPATCH_OR_RECOVERY_ASSIGNMENT_FILTERS = new Set<AdminBookingFilter>([
  "dispatch_not_started",
  "recovery_needed",
]);

export type ServerSideAssignmentFilter =
  | "max_attempts"
  | "selected_declined"
  | "dispatch_not_started"
  | "recovery_needed"
  | "assignment_attention";

export type AdminAssignmentFilterSql = {
  filter?: ServerSideAssignmentFilter;
  declinedOfferBookingIds?: string[];
  recoveryCandidateBookingIds?: string[];
  openOfferBookingIds?: string[];
};

export type AssignmentAttentionFilterContext = {
  payments?: readonly DispatchFilterPayment[];
  offers?: readonly DispatchFilterOffer[];
  declinedOfferBookingIds?: ReadonlySet<string>;
  openOfferBookingIds?: ReadonlySet<string>;
  recoveryCandidateBookingIds?: ReadonlySet<string>;
  now?: Date;
  graceMinutes?: number;
};

export type AdminAssignmentSqlFilterableQuery = {
  eq: (column: string, value: string) => AdminAssignmentSqlFilterableQuery;
  filter: (column: string, operator: string, value: string) => AdminAssignmentSqlFilterableQuery;
  or: (filters: string) => AdminAssignmentSqlFilterableQuery;
  in: (column: string, values: string[]) => AdminAssignmentSqlFilterableQuery;
};

export function isMaxAttemptsReason(reason: string | null | undefined): boolean {
  return (
    typeof reason === "string" &&
    reason.toLowerCase().includes(MAX_ATTEMPTS_REASON_FRAGMENT)
  );
}

export function isServerSideAssignmentFilter(
  filter: AdminBookingFilter | undefined,
): filter is ServerSideAssignmentFilter {
  return filter != null && SERVER_SIDE_ASSIGNMENT_FILTERS.has(filter);
}

export function usesDispatchOrRecoveryPredicateBundle(
  filter: AdminBookingFilter | undefined,
): filter is "dispatch_not_started" | "recovery_needed" {
  return filter != null && DISPATCH_OR_RECOVERY_ASSIGNMENT_FILTERS.has(filter);
}

export type DispatchFilterPayment = {
  status: string;
  updated_at: string;
  created_at: string;
};

export type DispatchFilterOffer = {
  status: string;
  expires_at: string | null;
};

type DispatchNotStartedPayments = Parameters<typeof computeDispatchNotStarted>[0]["payments"];

function dispatchPayments(
  payments: readonly DispatchFilterPayment[] | undefined,
): DispatchNotStartedPayments {
  return (payments ?? []) as DispatchNotStartedPayments;
}

/** Pure classifier mirroring SQL predicates (parity oracle). */
export function matchesBookingRowForAssignmentFilterSql(
  row: {
    id: string;
    status: BookingStatus | string;
    cleaner_id?: string | null;
    metadata: Json | null | undefined;
  },
  filter: ServerSideAssignmentFilter,
  declinedOfferBookingIds: ReadonlySet<string> = new Set(),
  dispatchContext: AssignmentAttentionFilterContext = {},
): boolean {
  if (filter === "max_attempts") {
    return matchesMaxAttemptsBookingRow(row);
  }
  if (filter === "selected_declined") {
    return matchesSelectedDeclinedBookingRow(row, declinedOfferBookingIds);
  }
  if (filter === "dispatch_not_started") {
    return matchesDispatchNotStartedBookingRow(row, dispatchContext);
  }
  if (filter === "recovery_needed") {
    return matchesRecoveryNeededBookingRow(row, dispatchContext);
  }
  return matchesBookingRowForAssignmentAttentionSql(row, {
    ...dispatchContext,
    declinedOfferBookingIds,
  });
}

/**
 * Parity oracle for recovery_needed. equivalent to dispatch_not_started SQL bundle
 * (recoveryEligible OR visibility key dispatch_not_started ≡ computeDispatchNotStarted).
 */
export function matchesRecoveryNeededBookingRow(
  row: {
    id: string;
    status: BookingStatus | string;
    cleaner_id?: string | null;
    metadata: Json | null | undefined;
  },
  context: {
    payments?: readonly DispatchFilterPayment[];
    offers?: readonly DispatchFilterOffer[];
    recoveryCandidateBookingIds?: ReadonlySet<string>;
    now?: Date;
    graceMinutes?: number;
  } = {},
): boolean {
  return matchesDispatchNotStartedBookingRow(row, context);
}

/** Shared Branch A + Branch B PostgREST `.or()` for dispatch_not_started and recovery_needed. */
export function applyDispatchOrRecoveryNeededFilterSql<T extends AdminAssignmentSqlFilterableQuery>(
  builder: T,
  recoveryCandidateBookingIds: string[] = [],
): T {
  const orParts: string[] = [
    `metadata->assignment->>reason.ilike.${encodePostgrestOrLiteral(
      `%${escapeIlikePattern(DISPATCH_NOT_STARTED_REASON_FRAGMENT)}%`,
    )}`,
  ];
  if (recoveryCandidateBookingIds.length > 0) {
    orParts.push(
      `and(status.eq.confirmed,cleaner_id.is.null,id.in.(${recoveryCandidateBookingIds.join(",")}))`,
    );
  }
  return builder.or(orParts.join(",")) as T;
}

/** Parity oracle ≡ `computeDispatchNotStarted`. */
export function matchesDispatchNotStartedBookingRow(
  row: {
    id: string;
    status: BookingStatus | string;
    cleaner_id?: string | null;
    metadata: Json | null | undefined;
  },
  context: {
    payments?: readonly DispatchFilterPayment[];
    offers?: readonly DispatchFilterOffer[];
    recoveryCandidateBookingIds?: ReadonlySet<string>;
    now?: Date;
    graceMinutes?: number;
  } = {},
): boolean {
  const assignmentReason = readAssignmentMetadata(row.metadata)?.reason ?? null;

  if (isDispatchNotStartedAttentionReason(assignmentReason)) {
    return true;
  }

  if (row.status !== "confirmed" || row.cleaner_id) {
    return false;
  }

  const recoveryIds = context.recoveryCandidateBookingIds;
  if (recoveryIds?.has(row.id)) {
    return true;
  }

  const payments = context.payments ?? [];
  const offers = context.offers ?? [];
  const paidPayment = payments.find((p) => p.status === "paid");
  if (!paidPayment) return false;

  const now = context.now ?? new Date();
  const graceMinutes = context.graceMinutes ?? ASSIGNMENT_RECOVERY_GRACE_MINUTES;
  const paidAtMs = new Date(paidPayment.updated_at || paidPayment.created_at).getTime();
  if (Number.isNaN(paidAtMs) || now.getTime() - paidAtMs < graceMinutes * 60_000) {
    return false;
  }

  if (offers.some((o) => o.status === "accepted")) return false;
  if (offers.some((o) => isOfferOpenForOps(o, now))) return false;

  return true;
}

/** Booking ids paid past grace with no open/accepted offers (Branch B helper set). */
export async function buildRecoveryCandidateBookingIds(
  client: SupabaseClient,
  options: { now?: Date; graceMinutes?: number } = {},
): Promise<string[]> {
  const now = options.now ?? new Date();
  const graceMinutes = options.graceMinutes ?? ASSIGNMENT_RECOVERY_GRACE_MINUTES;
  const graceCutoffMs = now.getTime() - graceMinutes * 60_000;

  const { data: payments, error: payErr } = await client
    .from("payments")
    .select("booking_id, status, updated_at, created_at")
    .eq("status", "paid");

  if (payErr) {
    throw new Error(payErr.message);
  }

  const paidPastGraceBookingIds = new Set<string>();
  for (const payment of payments ?? []) {
    if (payment.status !== "paid") continue;
    const paidAtMs = new Date(payment.updated_at || payment.created_at).getTime();
    if (Number.isNaN(paidAtMs) || paidAtMs > graceCutoffMs) continue;
    paidPastGraceBookingIds.add(payment.booking_id as string);
  }

  const { data: offers, error: offerErr } = await client
    .from("assignment_offers")
    .select("booking_id, status, expires_at");

  if (offerErr) {
    throw new Error(offerErr.message);
  }

  const blockedBookingIds = new Set<string>();
  for (const offer of offers ?? []) {
    const bookingId = offer.booking_id as string;
    if (offer.status === "accepted") {
      blockedBookingIds.add(bookingId);
      continue;
    }
    if (isOfferOpenForOps({ status: offer.status, expires_at: offer.expires_at }, now)) {
      blockedBookingIds.add(bookingId);
    }
  }

  return [...paidPastGraceBookingIds].filter((id) => !blockedBookingIds.has(id));
}

export function matchesMaxAttemptsBookingRow(row: {
  status: BookingStatus | string;
  metadata: Json | null | undefined;
}): boolean {
  if (row.status !== "pending_assignment") return false;
  const assignment = readAssignmentMetadata(row.metadata);
  return isMaxAttemptsReason(assignment?.reason ?? null);
}

export function buildMaxAttemptsAttentionOrPart(): string {
  const pattern = encodePostgrestOrLiteral(
    `%${escapeIlikePattern(MAX_ATTEMPTS_REASON_FRAGMENT)}%`,
  );
  return `and(status.eq.pending_assignment,metadata->assignment->>reason.ilike.${pattern})`;
}

export function buildSelectedDeclinedAttentionOrPart(declinedOfferBookingIds: string[]): string {
  const declinedParts: string[] = [
    "metadata->assignment->>lastOfferOutcome.eq.declined",
    `metadata->assignment->>reason.ilike.${encodePostgrestOrLiteral(`%${escapeIlikePattern("declined")}%`)}`,
  ];
  if (declinedOfferBookingIds.length > 0) {
    declinedParts.push(`id.in.(${declinedOfferBookingIds.join(",")})`);
  }
  return `and(status.eq.pending_assignment,metadata->assignment->>status.eq.attention_required,metadata->assignment->>path.eq.selected,or(${declinedParts.join(",")}))`;
}

export function buildNeedsAssignmentAttentionOrPart(openOfferBookingIds: string[]): string {
  let part =
    "and(status.eq.pending_assignment,metadata->assignment->>status.eq.attention_required,metadata->assignment->>path.neq.selected";
  if (openOfferBookingIds.length > 0) {
    part += `,id.not.in.(${openOfferBookingIds.join(",")})`;
  }
  return `${part})`;
}

export function buildConfirmedAttentionMetadataOrPart(): string {
  const dispatchPattern = encodePostgrestOrLiteral(
    `%${escapeIlikePattern(DISPATCH_NOT_STARTED_REASON_FRAGMENT)}%`,
  );
  return `and(status.eq.confirmed,cleaner_id.is.null,metadata->assignment->>status.eq.attention_required,metadata->assignment->>reason.not.ilike.${dispatchPattern})`;
}

export function buildAssignmentAttentionOrParts(input: {
  declinedOfferBookingIds?: string[];
  openOfferBookingIds?: string[];
}): string[] {
  const declinedIds = input.declinedOfferBookingIds ?? [];
  const openIds = input.openOfferBookingIds ?? [];
  return [
    buildMaxAttemptsAttentionOrPart(),
    buildSelectedDeclinedAttentionOrPart(declinedIds),
    buildNeedsAssignmentAttentionOrPart(openIds),
    buildConfirmedAttentionMetadataOrPart(),
  ];
}

export function matchesNeedsAssignmentBookingRow(
  row: {
    id: string;
    status: BookingStatus | string;
    cleaner_id?: string | null;
    metadata: Json | null | undefined;
  },
  context: AssignmentAttentionFilterContext = {},
): boolean {
  if (row.status !== "pending_assignment") return false;

  const now = context.now ?? new Date();
  const offers = context.offers ?? [];
  const offerStatuses = offers.map((o) => o.status) as AssignmentOfferStatus[];
  const hasOpenOffer = offers.some((o) => isOfferOpenForOps(o, now));
  const dispatchNotStarted = computeDispatchNotStarted({
    bookingStatus: row.status as BookingStatus,
    cleanerId: row.cleaner_id ?? null,
    assignmentReason: readAssignmentMetadata(row.metadata)?.reason ?? null,
    payments: dispatchPayments(context.payments),
    offers,
    now,
    graceMinutes: context.graceMinutes,
  });

  const visibility = resolveAssignmentVisibility({
    bookingStatus: row.status as BookingStatus,
    metadata: row.metadata,
    hasOpenOffer,
    offerStatuses,
    dispatchNotStarted,
  });

  return visibility.key === "needs_assignment";
}

export function matchesConfirmedAttentionMetadataEdgeRow(
  row: {
    status: BookingStatus | string;
    cleaner_id?: string | null;
    metadata: Json | null | undefined;
  },
  context: AssignmentAttentionFilterContext = {},
): boolean {
  const now = context.now ?? new Date();
  const offers = context.offers ?? [];
  const offerStatuses = offers.map((o) => o.status) as AssignmentOfferStatus[];
  const hasOpenOffer = offers.some((o) => isOfferOpenForOps(o, now));
  const dispatchNotStarted = computeDispatchNotStarted({
    bookingStatus: row.status as BookingStatus,
    cleanerId: row.cleaner_id ?? null,
    assignmentReason: readAssignmentMetadata(row.metadata)?.reason ?? null,
    payments: dispatchPayments(context.payments),
    offers,
    now,
    graceMinutes: context.graceMinutes,
  });

  const visibility = resolveAssignmentVisibility({
    bookingStatus: row.status as BookingStatus,
    metadata: row.metadata,
    hasOpenOffer,
    offerStatuses,
    dispatchNotStarted,
  });

  if (visibility.key !== null) return false;

  const assignmentAttention =
    visibility.key ?? readAssignmentMetadata(row.metadata)?.status ?? null;
  return assignmentAttention === "attention_required";
}

/** Branch-composed classifier mirroring SQL OR fragments (parity with enrichment matcher). */
export function matchesAssignmentAttentionSqlBranches(
  row: {
    id: string;
    status: BookingStatus | string;
    cleaner_id?: string | null;
    metadata: Json | null | undefined;
  },
  context: AssignmentAttentionFilterContext = {},
): boolean {
  const declinedIds = context.declinedOfferBookingIds ?? new Set<string>();

  return (
    matchesMaxAttemptsBookingRow(row) ||
    matchesSelectedDeclinedBookingRow(row, declinedIds) ||
    matchesNeedsAssignmentBookingRow(row, context) ||
    matchesConfirmedAttentionMetadataEdgeRow(row, context)
  );
}

/** Golden parity oracle ≡ `matchesAdminBookingFilter(..., "assignment_attention")` on enriched fields. */
export function matchesBookingRowForAssignmentAttentionSql(
  row: {
    id: string;
    status: BookingStatus | string;
    cleaner_id?: string | null;
    metadata: Json | null | undefined;
  },
  context: AssignmentAttentionFilterContext = {},
): boolean {
  const now = context.now ?? new Date();
  const offers = context.offers ?? [];
  const offerStatuses = offers.map((o) => o.status) as AssignmentOfferStatus[];
  const hasOpenOffer = offers.some((o) => isOfferOpenForOps(o, now));
  const dispatchNotStarted = computeDispatchNotStarted({
    bookingStatus: row.status as BookingStatus,
    cleanerId: row.cleaner_id ?? null,
    assignmentReason: readAssignmentMetadata(row.metadata)?.reason ?? null,
    payments: dispatchPayments(context.payments),
    offers,
    now,
    graceMinutes: context.graceMinutes,
  });

  const visibility = resolveAssignmentVisibility({
    bookingStatus: row.status as BookingStatus,
    metadata: row.metadata,
    hasOpenOffer,
    offerStatuses,
    dispatchNotStarted,
  });

  const assignmentAttention =
    visibility.key ?? readAssignmentMetadata(row.metadata)?.status ?? null;

  return matchesAdminBookingFilter(
    {
      status: row.status as BookingStatus,
      assignmentVisibilityKey: visibility.key,
      assignmentAttention,
      paymentFailureReason: null,
    },
    "assignment_attention",
  );
}

export function applyAssignmentAttentionFilterSql<T extends AdminAssignmentSqlFilterableQuery>(
  builder: T,
  assignmentSql: Pick<AdminAssignmentFilterSql, "declinedOfferBookingIds" | "openOfferBookingIds">,
): T {
  const orParts = buildAssignmentAttentionOrParts({
    declinedOfferBookingIds: assignmentSql.declinedOfferBookingIds,
    openOfferBookingIds: assignmentSql.openOfferBookingIds,
  });
  return builder.or(orParts.join(",")) as T;
}

export async function buildDeclinedOfferBookingIds(client: SupabaseClient): Promise<string[]> {
  const { data, error } = await client
    .from("assignment_offers")
    .select("booking_id")
    .eq("status", "declined");

  if (error) {
    throw new Error(error.message);
  }

  return [
    ...new Set(
      (data ?? [])
        .map((row) => row.booking_id as string)
        .filter(Boolean),
    ),
  ];
}

export async function buildOpenOfferBookingIds(
  client: SupabaseClient,
  options: { now?: Date } = {},
): Promise<string[]> {
  const now = options.now ?? new Date();
  const { data, error } = await client.from("assignment_offers").select("booking_id, status, expires_at");

  if (error) {
    throw new Error(error.message);
  }

  const openOfferBookingIds = new Set<string>();
  for (const offer of data ?? []) {
    if (isOfferOpenForOps({ status: offer.status, expires_at: offer.expires_at }, now)) {
      openOfferBookingIds.add(offer.booking_id as string);
    }
  }

  return [...openOfferBookingIds];
}

export function matchesSelectedDeclinedBookingRow(
  row: {
    id: string;
    status: BookingStatus | string;
    metadata: Json | null | undefined;
  },
  declinedOfferBookingIds: ReadonlySet<string> = new Set(),
): boolean {
  if (row.status !== "pending_assignment") return false;
  const assignment = readAssignmentMetadata(row.metadata);
  if (!assignment) return false;
  if (isMaxAttemptsReason(assignment.reason)) return false;
  if (assignment.status !== "attention_required") return false;
  if (assignment.path !== "selected") return false;

  if (assignment.lastOfferOutcome === "declined") return true;

  const reasonLower = assignment.reason?.toLowerCase() ?? "";
  if (reasonLower.includes("declined")) return true;

  return declinedOfferBookingIds.has(row.id);
}

export async function resolveAdminAssignmentFilterSql(
  client: SupabaseClient,
  filter: AdminBookingFilter | undefined,
): Promise<AdminAssignmentFilterSql> {
  if (!isServerSideAssignmentFilter(filter)) {
    return {};
  }

  if (filter === "max_attempts") {
    return { filter: "max_attempts" };
  }

  if (usesDispatchOrRecoveryPredicateBundle(filter)) {
    const recoveryCandidateBookingIds = await buildRecoveryCandidateBookingIds(client);
    return { filter, recoveryCandidateBookingIds };
  }

  if (filter === "assignment_attention") {
    const [declinedOfferBookingIds, openOfferBookingIds] = await Promise.all([
      buildDeclinedOfferBookingIds(client),
      buildOpenOfferBookingIds(client),
    ]);
    return { filter: "assignment_attention", declinedOfferBookingIds, openOfferBookingIds };
  }

  const declinedOfferBookingIds = await buildDeclinedOfferBookingIds(client);
  return { filter: "selected_declined", declinedOfferBookingIds };
}

export function applyAdminAssignmentFilterSql<T extends AdminAssignmentSqlFilterableQuery>(
  builder: T,
  assignmentSql: AdminAssignmentFilterSql,
): T {
  if (!assignmentSql.filter) {
    return builder;
  }

  if (assignmentSql.filter === "max_attempts") {
    let q = builder.eq("status", "pending_assignment") as T;
    const pattern = `%${escapeIlikePattern(MAX_ATTEMPTS_REASON_FRAGMENT)}%`;
    q = q.filter(
      "metadata->assignment->>reason",
      "ilike",
      pattern,
    ) as T;
    return q;
  }

  if (
    assignmentSql.filter === "dispatch_not_started" ||
    assignmentSql.filter === "recovery_needed"
  ) {
    return applyDispatchOrRecoveryNeededFilterSql(
      builder,
      assignmentSql.recoveryCandidateBookingIds ?? [],
    );
  }

  if (assignmentSql.filter === "assignment_attention") {
    return applyAssignmentAttentionFilterSql(builder, assignmentSql);
  }

  let q = builder.eq("status", "pending_assignment") as T;
  q = q.filter("metadata->assignment->>status", "eq", "attention_required") as T;
  q = q.filter("metadata->assignment->>path", "eq", "selected") as T;

  const orParts: string[] = [
    "metadata->assignment->>lastOfferOutcome.eq.declined",
    `metadata->assignment->>reason.ilike.${encodePostgrestOrLiteral(`%${escapeIlikePattern("declined")}%`)}`,
  ];

  const declinedIds = assignmentSql.declinedOfferBookingIds ?? [];
  if (declinedIds.length > 0) {
    orParts.push(`id.in.(${declinedIds.join(",")})`);
  }

  return q.or(orParts.join(",")) as T;
}
