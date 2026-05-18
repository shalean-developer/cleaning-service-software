import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Json } from "@/lib/database/types";
import { buildOfferExpiresAt } from "@/features/assignments/server/buildOfferExpiry";
import { ASSIGNMENT_RECOVERY_GRACE_MINUTES } from "@/features/assignments/server/constants";
import { DISPATCH_NOT_STARTED_REASON } from "@/features/assignments/server/isAssignmentRecoveryCandidate";
import { resolveAssignmentVisibility } from "@/features/assignments/server/resolveAssignmentVisibility";
import { readAssignmentMetadata } from "@/features/assignments/server/assignmentMetadata";
import {
  applyAdminAssignmentFilterSql,
  applyAssignmentAttentionFilterSql,
  applyDispatchOrRecoveryNeededFilterSql,
  buildAssignmentAttentionOrParts,
  buildOpenOfferBookingIds,
  buildRecoveryCandidateBookingIds,
  matchesAssignmentAttentionSqlBranches,
  matchesBookingRowForAssignmentAttentionSql,
  matchesBookingRowForAssignmentFilterSql,
  matchesDispatchNotStartedBookingRow,
  matchesMaxAttemptsBookingRow,
  matchesRecoveryNeededBookingRow,
  matchesSelectedDeclinedBookingRow,
  resolveAdminAssignmentFilterSql,
  SERVER_SIDE_ASSIGNMENT_FILTERS,
} from "./adminAssignmentFilterSql";
import {
  computeDispatchNotStarted,
  computeRecoveryEligibility,
  matchesAdminBookingFilter,
} from "./adminOperationalHelpers";
import type { AdminBookingListItem } from "./types";
import { EMPTY_ADMIN_BOOKING_OBSERVATION } from "./adminBookingObservationFixtures";

const DISPATCH_NOW = new Date("2026-05-18T12:00:00.000Z");
const DISPATCH_PAID_AT = "2026-05-18T10:00:00.000Z";
const DISPATCH_INSIDE_GRACE_PAID_AT = "2026-05-18T11:59:00.000Z";

function assignmentMetadata(overrides: Record<string, unknown> = {}) {
  return {
    assignment: {
      engineVersion: "2026-05-16-phase8",
      status: "attention_required",
      path: "selected",
      attemptedAt: "2026-05-16T10:00:00.000Z",
      ...overrides,
    },
  };
}

function listItemFromRow(
  row: { id: string; status: string; metadata: Json },
  offers: { status: string; expires_at: string | null }[] = [],
): AdminBookingListItem & { dispatchNotStarted?: boolean; recoveryEligible?: boolean } {
  const offerStatuses = offers.map((o) => o.status) as import("@/lib/database/types").AssignmentOfferStatus[];
  const hasOpenOffer = offers.some(
    (o) => o.status === "offered" && new Date(o.expires_at ?? 0).getTime() > Date.now(),
  );
  const visibility = resolveAssignmentVisibility({
    bookingStatus: row.status as import("@/features/bookings/server/types").BookingStatus,
    metadata: row.metadata,
    hasOpenOffer,
    offerStatuses,
    dispatchNotStarted: false,
  });
  const assignment = readAssignmentMetadata(row.metadata);
  return {
    id: row.id,
    status: row.status as import("@/features/bookings/server/types").BookingStatus,
    paymentStatus: "paid",
    paymentFailureReason: null,
    customerLabel: "Acme",
    cleanerLabel: null,
    serviceLabel: "Deep clean",
    scheduleLabel: "Mon",
    priceLabel: "R500",
    priceCents: 50_000,
    observation: EMPTY_ADMIN_BOOKING_OBSERVATION,
    assignmentAttention: visibility.key ?? assignment?.status ?? null,
    assignmentVisibilityKey: visibility.key,
    dispatchNotStarted: false,
    recoveryEligible: false,
    updatedAt: "2026-05-16T10:00:00.000Z",
  };
}

function expectSqlParity(
  row: { id: string; status: string; metadata: Json },
  filter: "max_attempts" | "selected_declined",
  offers: { status: string; expires_at: string | null }[] = [],
  declinedOfferBookingIds: Set<string> = new Set(
    offers.filter((o) => o.status === "declined").map(() => row.id),
  ),
) {
  const item = listItemFromRow(row, offers);
  const sqlMatch = matchesBookingRowForAssignmentFilterSql(row, filter, declinedOfferBookingIds);
  const memoryMatch = matchesAdminBookingFilter(item, filter);
  expect(sqlMatch).toBe(memoryMatch);
}

describe("adminAssignmentFilterSql", () => {
  it("matches max_attempts on pending_assignment with max-attempts reason", () => {
    const row = {
      id: "b-max",
      status: "pending_assignment",
      metadata: assignmentMetadata({
        path: "best_available",
        reason: "Reached maximum assignment dispatch attempts for this booking.",
      }),
    };
    expect(matchesMaxAttemptsBookingRow(row)).toBe(true);
    expectSqlParity(row, "max_attempts");
  });

  it("does not match ordinary pending_assignment as max_attempts", () => {
    const row = {
      id: "b-pa",
      status: "pending_assignment",
      metadata: assignmentMetadata({
        path: "best_available",
        status: "attention_required",
        reason: "Needs cleaner",
      }),
    };
    expect(matchesMaxAttemptsBookingRow(row)).toBe(false);
    expectSqlParity(row, "max_attempts");
  });

  it("matches selected_declined for selected path with declined outcome", () => {
    const row = {
      id: "b-sel",
      status: "pending_assignment",
      metadata: assignmentMetadata({
        path: "selected",
        lastOfferOutcome: "declined",
        reason: "Selected cleaner declined the offer.",
      }),
    };
    expect(matchesSelectedDeclinedBookingRow(row)).toBe(true);
    expectSqlParity(row, "selected_declined");
  });

  it("does not match auto-dispatch decline_redispatched path as selected_declined", () => {
    const row = {
      id: "b-auto",
      status: "pending_assignment",
      metadata: assignmentMetadata({
        path: "best_available",
        status: "offered",
        reason: "Cleaner declined; redispatching",
        lastOfferOutcome: "declined",
      }),
    };
    const offers = [
      {
        status: "offered",
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
      },
      { status: "declined", expires_at: null },
    ];
    expect(matchesSelectedDeclinedBookingRow(row)).toBe(false);
    expectSqlParity(row, "selected_declined", offers, new Set());
  });

  it("does not match selected_declined for selected expired (UI filter is declined-only)", () => {
    const row = {
      id: "b-exp",
      status: "pending_assignment",
      metadata: assignmentMetadata({
        path: "selected",
        lastOfferOutcome: "expired",
        reason: "Selected cleaner offer expired",
      }),
    };
    expect(matchesSelectedDeclinedBookingRow(row)).toBe(false);
    expectSqlParity(row, "selected_declined");
  });

  it("matches selected_declined via declined offer rows when metadata lacks outcome", () => {
    const row = {
      id: "b-offer-only",
      status: "pending_assignment",
      metadata: assignmentMetadata({
        path: "selected",
        status: "attention_required",
        lastOfferOutcome: null,
        reason: null,
      }),
    };
    const declinedIds = new Set(["b-offer-only"]);
    expect(matchesSelectedDeclinedBookingRow(row, declinedIds)).toBe(true);
    expectSqlParity(row, "selected_declined", [{ status: "declined", expires_at: null }], declinedIds);
  });

  it("applyAdminAssignmentFilterSql chains metadata filters for selected_declined", () => {
    const calls: { method: string; args: unknown[] }[] = [];
    const builder = {
      eq: vi.fn((...args: unknown[]) => {
        calls.push({ method: "eq", args });
        return builder;
      }),
      filter: vi.fn((...args: unknown[]) => {
        calls.push({ method: "filter", args });
        return builder;
      }),
      or: vi.fn((...args: unknown[]) => {
        calls.push({ method: "or", args });
        return builder;
      }),
      in: vi.fn((...args: unknown[]) => {
        calls.push({ method: "in", args });
        return builder;
      }),
    };

    applyAdminAssignmentFilterSql(builder, {
      filter: "selected_declined",
      declinedOfferBookingIds: ["booking-a"],
    });

    expect(calls.some((c) => c.method === "eq" && c.args[1] === "pending_assignment")).toBe(true);
    expect(calls.some((c) => c.method === "filter" && c.args[0]?.toString().includes("path"))).toBe(
      true,
    );
    expect(calls.some((c) => c.method === "or")).toBe(true);
  });

  it("resolveAdminAssignmentFilterSql loads recovery candidate booking ids for dispatch_not_started", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(DISPATCH_NOW);
    const client = {
      from: vi.fn((table: string) => {
        if (table === "payments") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(async () => ({
                data: [
                  {
                    booking_id: "recovery-1",
                    status: "paid",
                    updated_at: DISPATCH_PAID_AT,
                    created_at: DISPATCH_PAID_AT,
                  },
                ],
                error: null,
              })),
            })),
          };
        }
        return {
          select: vi.fn(() => ({
            then: (onFulfilled: (v: { data: unknown[]; error: null }) => unknown) =>
              Promise.resolve({ data: [], error: null }).then(onFulfilled),
          })),
        };
      }),
    };

    const sql = await resolveAdminAssignmentFilterSql(client as never, "dispatch_not_started");
    expect(sql.filter).toBe("dispatch_not_started");
    expect(sql.recoveryCandidateBookingIds).toEqual(["recovery-1"]);
    vi.useRealTimers();
  });

  it("resolveAdminAssignmentFilterSql loads declined offer booking ids", async () => {
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({
            data: [{ booking_id: "booking-x" }, { booking_id: "booking-x" }],
            error: null,
          })),
        })),
      })),
    };

    const sql = await resolveAdminAssignmentFilterSql(client as never, "selected_declined");
    expect(sql.filter).toBe("selected_declined");
    expect(sql.declinedOfferBookingIds).toEqual(["booking-x"]);
  });
});

describe("dispatch_not_started filter parity", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(DISPATCH_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function expectDispatchParity(
    row: {
      id: string;
      status: string;
      cleaner_id?: string | null;
      metadata: Json;
    },
    payments: { status: "paid"; updated_at: string; created_at: string }[],
    offers: { status: string; expires_at: string | null }[],
    recoveryCandidateBookingIds: Set<string> = new Set(),
    now: Date = DISPATCH_NOW,
  ) {
    const assignmentReason = readAssignmentMetadata(row.metadata)?.reason ?? null;
    const dispatchNotStarted = computeDispatchNotStarted({
      bookingStatus: row.status as import("@/features/bookings/server/types").BookingStatus,
      cleanerId: row.cleaner_id ?? null,
      assignmentReason,
      payments,
      offers,
      now,
      graceMinutes: ASSIGNMENT_RECOVERY_GRACE_MINUTES,
    });
    const visibility = resolveAssignmentVisibility({
      bookingStatus: row.status as import("@/features/bookings/server/types").BookingStatus,
      metadata: row.metadata,
      hasOpenOffer: offers.some(
        (o) =>
          o.status === "offered" &&
          new Date(o.expires_at ?? 0).getTime() > now.getTime(),
      ),
      offerStatuses: offers.map((o) => o.status) as import("@/lib/database/types").AssignmentOfferStatus[],
      dispatchNotStarted,
    });
    const item: AdminBookingListItem & { dispatchNotStarted?: boolean } = {
      id: row.id,
      status: row.status as import("@/features/bookings/server/types").BookingStatus,
      paymentStatus: payments.some((p) => p.status === "paid") ? "paid" : null,
      paymentFailureReason: null,
      customerLabel: "Acme",
      cleanerLabel: null,
      serviceLabel: "Deep clean",
      scheduleLabel: "Mon",
      priceLabel: "R500",
      priceCents: 50_000,
      observation: EMPTY_ADMIN_BOOKING_OBSERVATION,
      assignmentAttention: null,
      assignmentVisibilityKey: visibility.key,
      dispatchNotStarted,
      recoveryEligible: false,
      updatedAt: "2026-05-16T10:00:00.000Z",
    };

    const sqlMatch = matchesDispatchNotStartedBookingRow(row, {
      payments,
      offers,
      recoveryCandidateBookingIds,
      now,
    });
    expect(sqlMatch).toBe(dispatchNotStarted);
    expect(matchesAdminBookingFilter(item, "dispatch_not_started")).toBe(dispatchNotStarted);
  }

  it("Branch A: metadata reason matches", () => {
    const row = {
      id: "reason-1",
      status: "confirmed",
      metadata: assignmentMetadata({
        status: "attention_required",
        reason: DISPATCH_NOT_STARTED_REASON,
      }),
    };
    expectDispatchParity(row, [], []);
  });

  it("Branch B: recovery candidate past grace with no offers", () => {
    const row = { id: "recovery-1", status: "confirmed", cleaner_id: null, metadata: {} };
    const payments = [
      {
        status: "paid" as const,
        updated_at: DISPATCH_PAID_AT,
        created_at: DISPATCH_PAID_AT,
      },
    ];
    const recoveryIds = new Set(["recovery-1"]);
    expectDispatchParity(row, payments, [], recoveryIds);
  });

  it("paid confirmed inside grace is false", () => {
    const row = { id: "grace-1", status: "confirmed", cleaner_id: null, metadata: {} };
    const payments = [
      {
        status: "paid" as const,
        updated_at: DISPATCH_INSIDE_GRACE_PAID_AT,
        created_at: DISPATCH_INSIDE_GRACE_PAID_AT,
      },
    ];
    expectDispatchParity(row, payments, []);
  });

  it("open offer blocks recovery path", () => {
    const row = { id: "open-1", status: "confirmed", cleaner_id: null, metadata: {} };
    const payments = [
      {
        status: "paid" as const,
        updated_at: DISPATCH_PAID_AT,
        created_at: DISPATCH_PAID_AT,
      },
    ];
    const offers = [
      {
        status: "offered",
        expires_at: buildOfferExpiresAt(new Date("2026-05-19T12:00:00.000Z")),
      },
    ];
    expectDispatchParity(row, payments, offers);
  });

  it("accepted offer blocks recovery path", () => {
    const row = { id: "acc-1", status: "confirmed", cleaner_id: null, metadata: {} };
    const payments = [
      {
        status: "paid" as const,
        updated_at: DISPATCH_PAID_AT,
        created_at: DISPATCH_PAID_AT,
      },
    ];
    expectDispatchParity(row, payments, [{ status: "accepted", expires_at: null }]);
  });

  it("assigned cleaner blocks recovery path", () => {
    const row = { id: "cl-1", status: "confirmed", cleaner_id: "cleaner-1", metadata: {} };
    const payments = [
      {
        status: "paid" as const,
        updated_at: DISPATCH_PAID_AT,
        created_at: DISPATCH_PAID_AT,
      },
    ];
    expectDispatchParity(row, payments, []);
  });

  it("unpaid confirmed is false", () => {
    const row = { id: "unpaid-1", status: "confirmed", cleaner_id: null, metadata: {} };
    expectDispatchParity(row, [], []);
  });

  it("terminal status without reason is false", () => {
    const row = { id: "done-1", status: "completed", cleaner_id: null, metadata: {} };
    const payments = [
      {
        status: "paid" as const,
        updated_at: DISPATCH_PAID_AT,
        created_at: DISPATCH_PAID_AT,
      },
    ];
    expectDispatchParity(row, payments, []);
  });

  it("ordinary pending_assignment without dispatch reason is false", () => {
    const row = {
      id: "pa-1",
      status: "pending_assignment",
      metadata: assignmentMetadata({ status: "attention_required", reason: "Needs cleaner" }),
    };
    expectDispatchParity(row, [], []);
  });

  it("max_attempts pending_assignment is not dispatch_not_started", () => {
    const row = {
      id: "max-1",
      status: "pending_assignment",
      metadata: assignmentMetadata({
        reason: "Reached maximum assignment dispatch attempts for this booking.",
      }),
    };
    expectDispatchParity(row, [], []);
    expect(matchesMaxAttemptsBookingRow(row)).toBe(true);
  });

  it("selected_declined is not dispatch_not_started", () => {
    const row = {
      id: "sel-1",
      status: "pending_assignment",
      metadata: assignmentMetadata({
        path: "selected",
        lastOfferOutcome: "declined",
        reason: "Selected cleaner declined",
      }),
    };
    expectDispatchParity(row, [], []);
    expect(matchesSelectedDeclinedBookingRow(row)).toBe(true);
  });

  it("expired offered only still matches recovery path", () => {
    const row = { id: "exp-offer-1", status: "confirmed", cleaner_id: null, metadata: {} };
    const payments = [
      {
        status: "paid" as const,
        updated_at: DISPATCH_PAID_AT,
        created_at: DISPATCH_PAID_AT,
      },
    ];
    const offers = [{ status: "offered", expires_at: "2026-05-01T08:00:00.000Z" }];
    expectDispatchParity(row, payments, offers, new Set(["exp-offer-1"]));
  });

  it("applyAdminAssignmentFilterSql uses same or bundle for recovery_needed as dispatch_not_started", () => {
    const builder = {
      eq: vi.fn(function (this: unknown) {
        return builder;
      }),
      filter: vi.fn(function (this: unknown) {
        return builder;
      }),
      or: vi.fn(function (this: unknown) {
        return builder;
      }),
      in: vi.fn(function (this: unknown) {
        return builder;
      }),
    };

    applyAdminAssignmentFilterSql(builder, {
      filter: "recovery_needed",
      recoveryCandidateBookingIds: ["booking-b"],
    });

    expect(builder.or).toHaveBeenCalledWith(
      expect.stringContaining("dispatch not started"),
    );
    expect(builder.or).toHaveBeenCalledWith(
      expect.stringContaining("status.eq.confirmed"),
    );
  });

  it("applyDispatchOrRecoveryNeededFilterSql matches dispatch_not_started apply path", () => {
    const dispatchOrCalls: string[] = [];
    const recoveryOrCalls: string[] = [];
    const makeBuilder = (sink: string[]) => ({
      eq: vi.fn(function (this: unknown) {
        return makeBuilder(sink);
      }),
      filter: vi.fn(function (this: unknown) {
        return makeBuilder(sink);
      }),
      or: vi.fn((filter: string) => {
        sink.push(filter);
        return makeBuilder(sink);
      }),
      in: vi.fn(function (this: unknown) {
        return makeBuilder(sink);
      }),
    });

    applyDispatchOrRecoveryNeededFilterSql(makeBuilder(dispatchOrCalls), ["id-1"]);
    applyDispatchOrRecoveryNeededFilterSql(makeBuilder(recoveryOrCalls), ["id-1"]);

    expect(dispatchOrCalls[0]).toBe(recoveryOrCalls[0]);
  });

  it("applyAdminAssignmentFilterSql uses or for dispatch_not_started", () => {
    const builder = {
      eq: vi.fn(function (this: unknown) {
        return builder;
      }),
      filter: vi.fn(function (this: unknown) {
        return builder;
      }),
      or: vi.fn(function (this: unknown) {
        return builder;
      }),
      in: vi.fn(function (this: unknown) {
        return builder;
      }),
    };

    applyAdminAssignmentFilterSql(builder, {
      filter: "dispatch_not_started",
      recoveryCandidateBookingIds: ["booking-a"],
    });

    expect(builder.or).toHaveBeenCalledWith(
      expect.stringContaining("dispatch not started"),
    );
    expect(builder.or).toHaveBeenCalledWith(
      expect.stringContaining("status.eq.confirmed"),
    );
  });

  it("buildRecoveryCandidateBookingIds excludes open and accepted offers", async () => {
    const client = {
      from: vi.fn((table: string) => {
        if (table === "payments") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(async () => ({
                data: [
                  {
                    booking_id: "ok-1",
                    status: "paid",
                    updated_at: DISPATCH_PAID_AT,
                    created_at: DISPATCH_PAID_AT,
                  },
                  {
                    booking_id: "open-1",
                    status: "paid",
                    updated_at: DISPATCH_PAID_AT,
                    created_at: DISPATCH_PAID_AT,
                  },
                ],
                error: null,
              })),
            })),
          };
        }
        return {
          select: vi.fn(() => ({
            then: (
              onFulfilled: (v: {
                data: { booking_id: string; status: string; expires_at: string }[];
                error: null;
              }) => unknown,
            ) =>
              Promise.resolve({
                data: [
                  {
                    booking_id: "open-1",
                    status: "offered",
                    expires_at: buildOfferExpiresAt(DISPATCH_NOW),
                  },
                ],
                error: null,
              }).then(onFulfilled),
          })),
        };
      }),
    };

    const ids = await buildRecoveryCandidateBookingIds(client as never, { now: DISPATCH_NOW });
    expect(ids).toEqual(["ok-1"]);
  });
});

describe("recovery_needed filter parity", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(DISPATCH_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function expectRecoveryParity(
    row: {
      id: string;
      status: string;
      cleaner_id?: string | null;
      metadata: Json;
    },
    payments: { status: "paid"; updated_at: string; created_at: string }[] = [],
    offers: { status: string; expires_at: string | null }[] = [],
    recoveryCandidateBookingIds: Set<string> = new Set(),
  ) {
    const ctx = {
      payments,
      offers,
      recoveryCandidateBookingIds,
      now: DISPATCH_NOW,
    };
    const recoverySql = matchesRecoveryNeededBookingRow(row, ctx);
    const dispatchSql = matchesDispatchNotStartedBookingRow(row, ctx);
    expect(recoverySql).toBe(dispatchSql);

    const assignmentReason = readAssignmentMetadata(row.metadata)?.reason ?? null;
    const dispatchNotStarted = computeDispatchNotStarted({
      bookingStatus: row.status as import("@/features/bookings/server/types").BookingStatus,
      cleanerId: row.cleaner_id ?? null,
      assignmentReason,
      payments,
      offers,
      now: DISPATCH_NOW,
      graceMinutes: ASSIGNMENT_RECOVERY_GRACE_MINUTES,
    });
    const visibility = resolveAssignmentVisibility({
      bookingStatus: row.status as import("@/features/bookings/server/types").BookingStatus,
      metadata: row.metadata,
      hasOpenOffer: offers.some(
        (o) =>
          o.status === "offered" &&
          new Date(o.expires_at ?? 0).getTime() > DISPATCH_NOW.getTime(),
      ),
      offerStatuses: offers.map((o) => o.status) as import("@/lib/database/types").AssignmentOfferStatus[],
      dispatchNotStarted,
    });
    const hasOpenOffer = offers.some(
      (o) =>
        o.status === "offered" &&
        new Date(o.expires_at ?? 0).getTime() > DISPATCH_NOW.getTime(),
    );
    const { eligibility } = computeRecoveryEligibility({
      bookingStatus: row.status as import("@/features/bookings/server/types").BookingStatus,
      cleanerId: row.cleaner_id ?? null,
      payments,
      offers,
      hasOpenOffer,
      now: DISPATCH_NOW,
      graceMinutes: ASSIGNMENT_RECOVERY_GRACE_MINUTES,
    });

    const memoryMatch = matchesAdminBookingFilter(
      {
        status: row.status as import("@/features/bookings/server/types").BookingStatus,
        assignmentVisibilityKey: visibility.key,
        assignmentAttention: null,
        paymentFailureReason: null,
        dispatchNotStarted,
        recoveryEligible: eligibility === "eligible",
      },
      "recovery_needed",
    );
    expect(recoverySql).toBe(memoryMatch);
  }

  it("resolveAdminAssignmentFilterSql loads recovery ids for recovery_needed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(DISPATCH_NOW);
    const client = {
      from: vi.fn((table: string) => {
        if (table === "payments") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(async () => ({
                data: [
                  {
                    booking_id: "recovery-1",
                    status: "paid",
                    updated_at: DISPATCH_PAID_AT,
                    created_at: DISPATCH_PAID_AT,
                  },
                ],
                error: null,
              })),
            })),
          };
        }
        return {
          select: vi.fn(() => ({
            then: (onFulfilled: (v: { data: unknown[]; error: null }) => unknown) =>
              Promise.resolve({ data: [], error: null }).then(onFulfilled),
          })),
        };
      }),
    };

    const sql = await resolveAdminAssignmentFilterSql(client as never, "recovery_needed");
    expect(sql.filter).toBe("recovery_needed");
    expect(sql.recoveryCandidateBookingIds).toEqual(["recovery-1"]);
    vi.useRealTimers();
  });

  it("Branch A: reason matches recovery_needed", () => {
    expectRecoveryParity({
      id: "reason-1",
      status: "confirmed",
      metadata: assignmentMetadata({
        status: "attention_required",
        reason: DISPATCH_NOT_STARTED_REASON,
      }),
    });
  });

  it("Branch B: eligible candidate matches recovery_needed", () => {
    expectRecoveryParity(
      { id: "recovery-1", status: "confirmed", cleaner_id: null, metadata: {} },
      [{ status: "paid", updated_at: DISPATCH_PAID_AT, created_at: DISPATCH_PAID_AT }],
      [],
      new Set(["recovery-1"]),
    );
  });

  it("excludes grace-only without reason", () => {
    expectRecoveryParity(
      { id: "grace-1", status: "confirmed", cleaner_id: null, metadata: {} },
      [{ status: "paid", updated_at: DISPATCH_INSIDE_GRACE_PAID_AT, created_at: DISPATCH_INSIDE_GRACE_PAID_AT }],
    );
  });

  it("excludes unpaid confirmed", () => {
    expectRecoveryParity({ id: "unpaid-1", status: "confirmed", cleaner_id: null, metadata: {} });
  });

  it("excludes open offer", () => {
    expectRecoveryParity(
      { id: "open-1", status: "confirmed", cleaner_id: null, metadata: {} },
      [{ status: "paid", updated_at: DISPATCH_PAID_AT, created_at: DISPATCH_PAID_AT }],
      [
        {
          status: "offered",
          expires_at: buildOfferExpiresAt(new Date("2026-05-19T12:00:00.000Z")),
        },
      ],
    );
  });
});

const ATTENTION_NOW = new Date("2026-05-18T12:00:00.000Z");

describe("assignment_attention filter parity (6C-3d)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(ATTENTION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function attentionContext(
    row: { id: string },
    offers: { status: string; expires_at: string | null }[] = [],
    declinedOfferBookingIds: string[] = [],
    openOfferBookingIds: string[] = [],
    payments: { status: string; updated_at: string; created_at: string }[] = [],
  ) {
    return {
      payments,
      offers,
      declinedOfferBookingIds: new Set(declinedOfferBookingIds),
      openOfferBookingIds: new Set(openOfferBookingIds),
      now: ATTENTION_NOW,
    };
  }

  function expectAttentionParity(
    row: { id: string; status: string; cleaner_id?: string | null; metadata: Json },
    offers: { status: string; expires_at: string | null }[] = [],
    declinedOfferBookingIds: string[] = [],
    openOfferBookingIds: string[] = [],
    payments: { status: string; updated_at: string; created_at: string }[] = [],
  ) {
    const ctx = attentionContext(row, offers, declinedOfferBookingIds, openOfferBookingIds, payments);
    const item = listItemFromRow(row, offers);
    const oracle = matchesBookingRowForAssignmentAttentionSql(row, ctx);
    const branches = matchesAssignmentAttentionSqlBranches(row, ctx);
    const memory = matchesAdminBookingFilter(item, "assignment_attention");
    const sqlFilter = matchesBookingRowForAssignmentFilterSql(
      row,
      "assignment_attention",
      ctx.declinedOfferBookingIds,
      ctx,
    );
    expect(oracle).toBe(memory);
    expect(branches).toBe(oracle);
    expect(sqlFilter).toBe(oracle);
  }

  it("registers assignment_attention as server-side", () => {
    expect(SERVER_SIDE_ASSIGNMENT_FILTERS.has("assignment_attention")).toBe(true);
  });

  it("includes needs_assignment", () => {
    expectAttentionParity({
      id: "needs-1",
      status: "pending_assignment",
      metadata: assignmentMetadata({ path: "best_available", status: "attention_required" }),
    });
  });

  it("includes selected_declined_admin", () => {
    expectAttentionParity(
      {
        id: "sel-dec-1",
        status: "pending_assignment",
        metadata: assignmentMetadata({
          path: "selected",
          lastOfferOutcome: "declined",
        }),
      },
      [],
      ["sel-dec-1"],
    );
  });

  it("includes max_attempts_admin", () => {
    expectAttentionParity({
      id: "max-1",
      status: "pending_assignment",
      metadata: assignmentMetadata({
        path: "best_available",
        reason: "Reached maximum assignment dispatch attempts for this booking.",
      }),
    });
  });

  it("includes confirmed metadata attention edge", () => {
    expectAttentionParity({
      id: "conf-edge-1",
      status: "confirmed",
      cleaner_id: null,
      metadata: assignmentMetadata({ status: "attention_required", reason: "Awaiting dispatch" }),
    });
  });

  it("excludes dispatch_not_started", () => {
    expectAttentionParity({
      id: "dispatch-1",
      status: "confirmed",
      cleaner_id: null,
      metadata: assignmentMetadata({
        status: "attention_required",
        reason: DISPATCH_NOT_STARTED_REASON,
      }),
    });
  });

  it("excludes recovery_needed (paid past grace, no cleaner)", () => {
    expectAttentionParity(
      { id: "recovery-1", status: "confirmed", cleaner_id: null, metadata: {} },
      [],
      [],
      [],
      [{ status: "paid", updated_at: DISPATCH_PAID_AT, created_at: DISPATCH_PAID_AT }],
    );
  });

  it("excludes selected_expired_admin", () => {
    expectAttentionParity({
      id: "exp-1",
      status: "pending_assignment",
      metadata: assignmentMetadata({
        path: "selected",
        lastOfferOutcome: "expired",
        reason: "Selected cleaner offer expired",
      }),
    });
  });

  it("excludes decline_redispatched", () => {
    expectAttentionParity(
      {
        id: "redisp-1",
        status: "pending_assignment",
        metadata: assignmentMetadata({
          path: "best_available",
          status: "offered",
          lastOfferOutcome: "declined",
        }),
      },
      [
        { status: "declined", expires_at: null },
        {
          status: "offered",
          expires_at: buildOfferExpiresAt(new Date("2026-05-19T12:00:00.000Z")),
        },
      ],
    );
  });

  it("excludes finding_cleaner with open offer", () => {
    expectAttentionParity(
      {
        id: "find-1",
        status: "pending_assignment",
        metadata: assignmentMetadata({ path: "best_available", status: "offered" }),
      },
      [
        {
          status: "offered",
          expires_at: buildOfferExpiresAt(new Date("2026-05-19T12:00:00.000Z")),
        },
      ],
      [],
      ["find-1"],
    );
  });

  it("excludes offer_sent", () => {
    expectAttentionParity(
      {
        id: "offer-1",
        status: "pending_assignment",
        metadata: assignmentMetadata({ path: "selected", status: "offered" }),
      },
      [
        {
          status: "offered",
          expires_at: buildOfferExpiresAt(new Date("2026-05-19T12:00:00.000Z")),
        },
      ],
    );
  });

  it("excludes payment_failed", () => {
    expectAttentionParity({
      id: "pay-fail-1",
      status: "payment_failed",
      metadata: assignmentMetadata(),
    });
  });

  it("excludes ordinary pending_assignment without attention_required", () => {
    expectAttentionParity({
      id: "ordinary-1",
      status: "pending_assignment",
      metadata: assignmentMetadata({ path: "best_available", status: "offered", reason: "Queued" }),
    });
  });

  it("builds composed OR parts for PostgREST", () => {
    const parts = buildAssignmentAttentionOrParts({
      declinedOfferBookingIds: ["decl-1"],
      openOfferBookingIds: ["open-1"],
    });
    expect(parts).toHaveLength(4);
    expect(parts[0]).toContain("maximum assignment dispatch attempts");
    expect(parts[1]).toContain("path.eq.selected");
    expect(parts[2]).toContain("path.neq.selected");
    expect(parts[2]).toContain("id.not.in.(open-1)");
    expect(parts[3]).toContain("status.eq.confirmed");
  });

  it("applyAssignmentAttentionFilterSql joins OR parts", () => {
    const calls: string[] = [];
    const builder = {
      eq: vi.fn(() => builder),
      filter: vi.fn(() => builder),
      in: vi.fn(() => builder),
      or: (filter: string) => {
        calls.push(filter);
        return builder;
      },
    };
    applyAssignmentAttentionFilterSql(builder, {
      declinedOfferBookingIds: [],
      openOfferBookingIds: [],
    });
    expect(calls[0]).toContain("status.eq.pending_assignment");
    expect(calls[0]).toContain("status.eq.confirmed");
  });

  it("resolveAdminAssignmentFilterSql loads declined and open offer ids", async () => {
    const client = {
      from: vi.fn((table: string) => {
        if (table !== "assignment_offers") {
          return { select: vi.fn() };
        }
        return {
          select: vi.fn((columns?: string) => ({
            eq: vi.fn(async (_col: string, val: string) => ({
              data: val === "declined" ? [{ booking_id: "decl-1" }] : [],
              error: null,
            })),
            then: (
              onFulfilled: (v: {
                data: { booking_id: string; status: string; expires_at: string }[];
                error: null;
              }) => unknown,
            ) =>
              Promise.resolve({
                data: [
                  {
                    booking_id: "open-1",
                    status: "offered",
                    expires_at: buildOfferExpiresAt(ATTENTION_NOW),
                  },
                ],
                error: null,
              }).then(onFulfilled),
          })),
        };
      }),
    };

    const sql = await resolveAdminAssignmentFilterSql(client as never, "assignment_attention");
    expect(sql.filter).toBe("assignment_attention");
    expect(sql.declinedOfferBookingIds).toEqual(["decl-1"]);
    expect(sql.openOfferBookingIds).toEqual(["open-1"]);
  });

  it("buildOpenOfferBookingIds collects open offers", async () => {
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          then: (onFulfilled: (v: { data: unknown[]; error: null }) => unknown) =>
            Promise.resolve({
              data: [
                {
                  booking_id: "open-1",
                  status: "offered",
                  expires_at: buildOfferExpiresAt(ATTENTION_NOW),
                },
                { booking_id: "closed-1", status: "expired", expires_at: null },
              ],
              error: null,
            }).then(onFulfilled),
        })),
      })),
    };
    const ids = await buildOpenOfferBookingIds(client as never, { now: ATTENTION_NOW });
    expect(ids).toEqual(["open-1"]);
  });
});
