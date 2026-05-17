import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/types";
import { ADMIN_BOOKINGS_LIST_LIMIT } from "./adminOperationalHelpers";
import { matchesBookingRowForAssignmentFilterSql } from "./adminAssignmentFilterSql";
import { isOfferOpenForOps } from "@/features/assignments/server/buildOfferExpiry";
import { ASSIGNMENT_RECOVERY_GRACE_MINUTES } from "@/features/assignments/server/constants";

const createSupabaseServerClientMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => createSupabaseServerClientMock(),
}));

const adminUser: CurrentUser = {
  profileId: "profile-admin",
  role: "admin",
  authUser: { id: "auth-admin" } as CurrentUser["authUser"],
};

type BookingRow = {
  id: string;
  status: string;
  customer_id: string;
  cleaner_id: string | null;
  scheduled_start: string;
  scheduled_end: string;
  price_cents: number;
  currency: string;
  metadata: Record<string, unknown>;
  updated_at: string;
};

function bookingRow(overrides: Partial<BookingRow> = {}): BookingRow {
  return {
    id: overrides.id ?? "booking-1",
    status: overrides.status ?? "confirmed",
    customer_id: "cust-1",
    cleaner_id: null,
    scheduled_start: overrides.scheduled_start ?? "2026-05-20T08:00:00.000Z",
    scheduled_end: "2026-05-20T10:00:00.000Z",
    price_cents: 50_000,
    currency: "ZAR",
    metadata: {},
    updated_at: overrides.updated_at ?? "2026-05-16T10:00:00.000Z",
    ...overrides,
  };
}

type RecoveryPaymentRow = {
  booking_id: string;
  status: string;
  updated_at: string;
  created_at: string;
};

type RecoveryOfferRow = {
  booking_id: string;
  status: string;
  expires_at: string | null;
};

type SearchFixture = {
  customers?: { id: string; company_name: string }[];
  payments?: { booking_id: string; provider_ref: string }[];
  declinedOffers?: { booking_id: string }[];
  recoveryPayments?: RecoveryPaymentRow[];
  recoveryOffers?: RecoveryOfferRow[];
  paymentsByBooking?: Record<string, { status: string; updated_at: string; created_at: string }[]>;
  offersByBooking?: Record<string, { status: string; expires_at: string | null }[]>;
  activeAssignmentFilter?:
    | "max_attempts"
    | "selected_declined"
    | "dispatch_not_started"
    | "recovery_needed"
    | "assignment_attention";
  assignmentOffers?: RecoveryOfferRow[];
  dispatchFilterNow?: Date;
};

function recoveryCandidateIdsFromFixture(fixture: SearchFixture): Set<string> {
  const now = fixture.dispatchFilterNow ?? new Date();
  const graceCutoffMs = now.getTime() - ASSIGNMENT_RECOVERY_GRACE_MINUTES * 60_000;
  const paidPastGrace = new Set<string>();
  for (const payment of fixture.recoveryPayments ?? []) {
    if (payment.status !== "paid") continue;
    const paidAtMs = new Date(payment.updated_at || payment.created_at).getTime();
    if (Number.isNaN(paidAtMs) || paidAtMs > graceCutoffMs) continue;
    paidPastGrace.add(payment.booking_id);
  }
  const blocked = new Set<string>();
  for (const offer of fixture.recoveryOffers ?? []) {
    if (offer.status === "accepted") {
      blocked.add(offer.booking_id);
      continue;
    }
    if (isOfferOpenForOps({ status: offer.status, expires_at: offer.expires_at }, now)) {
      blocked.add(offer.booking_id);
    }
  }
  return new Set([...paidPastGrace].filter((id) => !blocked.has(id)));
}

function openOfferBookingIdsFromFixture(fixture: SearchFixture): Set<string> {
  const now = fixture.dispatchFilterNow ?? new Date();
  const ids = new Set<string>();
  for (const offer of fixture.assignmentOffers ?? fixture.recoveryOffers ?? []) {
    if (isOfferOpenForOps({ status: offer.status, expires_at: offer.expires_at }, now)) {
      ids.add(offer.booking_id);
    }
  }
  return ids;
}

function matchesActiveAssignmentFilter(row: BookingRow, fixture: SearchFixture): boolean {
  if (!fixture.activeAssignmentFilter) return true;
  const declinedOfferBookingIds = new Set(
    (fixture.declinedOffers ?? []).map((o) => o.booking_id),
  );
  const recoveryCandidateBookingIds = recoveryCandidateIdsFromFixture(fixture);
  return matchesBookingRowForAssignmentFilterSql(
    {
      ...row,
      metadata: row.metadata as import("@/lib/database/types").Json,
    },
    fixture.activeAssignmentFilter,
    declinedOfferBookingIds,
    {
      payments: fixture.paymentsByBooking?.[row.id] ?? [],
      offers: fixture.offersByBooking?.[row.id] ?? [],
      recoveryCandidateBookingIds,
      openOfferBookingIds: openOfferBookingIdsFromFixture(fixture),
      now: fixture.dispatchFilterNow,
    },
  );
}

function createBookingsClient(
  rows: BookingRow[],
  matchCount?: number,
  searchFixture: SearchFixture = {},
) {
  const declinedOfferBookingIds = new Set(
    (searchFixture.declinedOffers ?? []).map((o) => o.booking_id),
  );
  const listCalls: { method: string; args: unknown[] }[] = [];
  let listLimit = ADMIN_BOOKINGS_LIST_LIMIT;
  let searchOrFilter: string | null = null;
  let assignmentOrFilter: string | null = null;
  let forceEmptySearch = false;

  const listBuilder = {
    select: vi.fn((...args: unknown[]) => {
      listCalls.push({ method: "select", args });
      return listBuilder;
    }),
    eq: vi.fn((...args: unknown[]) => {
      listCalls.push({ method: "eq", args });
      return listBuilder;
    }),
    gte: vi.fn((...args: unknown[]) => {
      listCalls.push({ method: "gte", args });
      return listBuilder;
    }),
    lt: vi.fn((...args: unknown[]) => {
      listCalls.push({ method: "lt", args });
      return listBuilder;
    }),
    order: vi.fn((...args: unknown[]) => {
      listCalls.push({ method: "order", args });
      return listBuilder;
    }),
    limit: vi.fn((n: number) => {
      listCalls.push({ method: "limit", args: [n] });
      listLimit = n;
      return listBuilder;
    }),
    or: vi.fn((filter: string) => {
      listCalls.push({ method: "or", args: [filter] });
      if (filter.includes("metadata->assignment") || filter.includes("status.eq.confirmed")) {
        assignmentOrFilter = filter;
      } else {
        searchOrFilter = filter;
      }
      return listBuilder;
    }),
    in: vi.fn((column: string, values: string[]) => {
      listCalls.push({ method: "in", args: [column, values] });
      if (column === "id" && values.length === 1 && values[0] === "00000000-0000-0000-0000-000000000000") {
        forceEmptySearch = true;
      }
      return listBuilder;
    }),
    filter: vi.fn((...args: unknown[]) => {
      listCalls.push({ method: "filter", args });
      return listBuilder;
    }),
    then: (
      onFulfilled: (v: { data: BookingRow[]; error: null }) => unknown,
      onRejected?: (e: unknown) => unknown,
    ) => {
      let filtered = [...rows];
      if (forceEmptySearch) {
        filtered = [];
      } else if (searchOrFilter) {
        filtered = filtered.filter((row) => matchesSearchOrFilter(row, searchOrFilter!, searchFixture));
      }
      if (searchFixture.activeAssignmentFilter) {
        filtered = filtered.filter((row) => matchesActiveAssignmentFilter(row, searchFixture));
      }
      void assignmentOrFilter;
      for (const call of listCalls) {
        if (call.method === "eq" && call.args[0] === "status") {
          filtered = filtered.filter((r) => r.status === call.args[1]);
        }
        if (call.method === "gte" && call.args[0] === "scheduled_start") {
          const min = String(call.args[1]);
          filtered = filtered.filter((r) => r.scheduled_start >= min);
        }
        if (call.method === "lt" && call.args[0] === "scheduled_start") {
          const max = String(call.args[1]);
          filtered = filtered.filter((r) => r.scheduled_start < max);
        }
      }
      filtered.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      return Promise.resolve({ data: filtered.slice(0, listLimit), error: null }).then(
        onFulfilled,
        onRejected,
      );
    },
  };

  const countCalls: { method: string; args: unknown[] }[] = [];
  let countSearchOrFilter: string | null = null;
  let countForceEmptySearch = false;
  const countBuilder = {
    select: vi.fn((...args: unknown[]) => {
      countCalls.push({ method: "select", args });
      return countBuilder;
    }),
    eq: vi.fn((...args: unknown[]) => {
      countCalls.push({ method: "eq", args });
      return countBuilder;
    }),
    gte: vi.fn((...args: unknown[]) => {
      countCalls.push({ method: "gte", args });
      return countBuilder;
    }),
    lt: vi.fn((...args: unknown[]) => {
      countCalls.push({ method: "lt", args });
      return countBuilder;
    }),
    filter: vi.fn((...args: unknown[]) => {
      countCalls.push({ method: "filter", args });
      return countBuilder;
    }),
    or: vi.fn((filter: string) => {
      countCalls.push({ method: "or", args: [filter] });
      countSearchOrFilter = filter;
      return countBuilder;
    }),
    in: vi.fn((column: string, values: string[]) => {
      countCalls.push({ method: "in", args: [column, values] });
      if (column === "id" && values.length === 1 && values[0] === "00000000-0000-0000-0000-000000000000") {
        countForceEmptySearch = true;
      }
      return countBuilder;
    }),
    then: (
      onFulfilled: (v: { count: number; error: null }) => unknown,
      onRejected?: (e: unknown) => unknown,
    ) => {
      let filtered = [...rows];
      if (countForceEmptySearch) {
        filtered = [];
      } else if (countSearchOrFilter) {
        filtered = filtered.filter((row) =>
          matchesSearchOrFilter(row, countSearchOrFilter!, searchFixture),
        );
      }
      if (searchFixture.activeAssignmentFilter) {
        filtered = filtered.filter((row) => matchesActiveAssignmentFilter(row, searchFixture));
      }
      for (const call of countCalls) {
        if (call.method === "eq" && call.args[0] === "status") {
          filtered = filtered.filter((r) => r.status === call.args[1]);
        }
        if (call.method === "gte" && call.args[0] === "scheduled_start") {
          const min = String(call.args[1]);
          filtered = filtered.filter((r) => r.scheduled_start >= min);
        }
        if (call.method === "lt" && call.args[0] === "scheduled_start") {
          const max = String(call.args[1]);
          filtered = filtered.filter((r) => r.scheduled_start < max);
        }
      }
      return Promise.resolve({ count: matchCount ?? filtered.length, error: null }).then(
        onFulfilled,
        onRejected,
      );
    },
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "customers") {
        return {
          select: vi.fn((columns?: string) => {
            if (columns === "id") {
              return {
                ilike: vi.fn(async () => ({
                  data: searchFixture.customers ?? [],
                  error: null,
                })),
              };
            }
            return {
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: { company_name: "Acme Co" },
                  error: null,
                })),
              })),
            };
          }),
        };
      }
      if (table === "payments") {
        return {
          select: vi.fn((columns?: string) => {
            if (columns === "booking_id") {
              return {
                not: vi.fn(() => ({
                  ilike: vi.fn(async () => ({
                    data: searchFixture.payments ?? [],
                    error: null,
                  })),
                })),
              };
            }
            if (columns?.includes("updated_at")) {
              return {
                eq: vi.fn(async (_col: string, val: string) => ({
                  data: val === "paid" ? (searchFixture.recoveryPayments ?? []) : [],
                  error: null,
                })),
              };
            }
            return {
              eq: vi.fn(async (_col: string, bookingId: string) => ({
                data: searchFixture.paymentsByBooking?.[bookingId] ?? [],
                error: null,
              })),
            };
          }),
        };
      }
      if (table === "assignment_offers") {
        return {
          select: vi.fn((columns?: string) => {
            const allOffers =
              searchFixture.assignmentOffers ?? searchFixture.recoveryOffers ?? [];
            const builder = {
              eq: vi.fn(async (_col: string, val: string) => {
                if (columns === "booking_id") {
                  return {
                    data: val === "declined" ? (searchFixture.declinedOffers ?? []) : [],
                    error: null,
                  };
                }
                return {
                  data: searchFixture.offersByBooking?.[val] ?? [],
                  error: null,
                };
              }),
              then: (
                onFulfilled: (v: { data: RecoveryOfferRow[]; error: null }) => unknown,
                onRejected?: (e: unknown) => unknown,
              ) =>
                Promise.resolve({ data: allOffers, error: null }).then(onFulfilled, onRejected),
            };
            return builder;
          }),
        };
      }
      if (table !== "bookings") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: { company_name: "Acme" }, error: null })),
            })),
          })),
        };
      }
      return {
        select: vi.fn((columns: string, options?: { count: "exact"; head: true }) => {
          if (options?.count === "exact") return countBuilder;
          return listBuilder;
        }),
      };
    }),
    listCalls,
    countCalls,
  };
}

function matchesSearchOrFilter(
  row: BookingRow,
  orFilter: string,
  fixture: SearchFixture,
): boolean {
  const clauses = orFilter.split(",");
  return clauses.some((clause) => {
    if (clause.startsWith("id.ilike.")) {
      const pattern = clause.slice("id.ilike.".length).replace(/%$/, "").toLowerCase();
      return row.id.toLowerCase().startsWith(pattern);
    }
    if (clause.startsWith("customer_id.in.(")) {
      const ids = clause
        .slice("customer_id.in.(".length, -1)
        .split(",")
        .filter(Boolean);
      return ids.includes(row.customer_id);
    }
    if (clause.startsWith("id.in.(")) {
      const ids = clause.slice("id.in.(".length, -1).split(",").filter(Boolean);
      return ids.includes(row.id);
    }
    return false;
  });
}

function stubEnrichmentTables(client: ReturnType<typeof createBookingsClient>) {
  const baseFrom = client.from;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any).from = vi.fn((table: string) => {
    if (table === "bookings" || table === "customers") {
      return baseFrom(table);
    }
    if (table === "assignment_offers") {
      return baseFrom(table);
    }
    if (table === "booking_state_audit") {
      const auditBuilder = {
        eq: vi.fn(() => auditBuilder),
        order: vi.fn(() => auditBuilder),
        limit: vi.fn(async () => ({ data: [], error: null })),
      };
      return {
        select: vi.fn(() => auditBuilder),
      };
    }
    return baseFrom(table);
  });
}

function assignmentMeta(overrides: Record<string, unknown> = {}) {
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

describe("listAdminBookings (6C-1/6C-2/6C-3a server-side filters)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies payment_failed filter in SQL before limit", async () => {
    const failedRows = Array.from({ length: 5 }, (_, i) =>
      bookingRow({
        id: `failed-${i}`,
        status: "payment_failed",
        updated_at: `2026-05-${10 + i}T10:00:00.000Z`,
      }),
    );
    const client = createBookingsClient(
      [...failedRows, bookingRow({ id: "ok-1", status: "confirmed" })],
      5,
    );
    stubEnrichmentTables(client);
    createSupabaseServerClientMock.mockResolvedValue(client);

    const { listAdminBookings } = await import("./adminOperationsReadModel");
    const result = await listAdminBookings(adminUser, { filter: "payment_failed" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(client.listCalls.some((c) => c.method === "eq" && c.args[1] === "payment_failed")).toBe(
      true,
    );
    expect(result.bookings.every((b) => b.status === "payment_failed")).toBe(true);
    expect(result.matchTotal).toBe(5);
    expect(result.returnedCount).toBe(5);
    expect(result.capped).toBe(false);
  });

  it("applies pending_assignment filter in SQL before limit", async () => {
    const client = createBookingsClient(
      [
        bookingRow({ id: "pa-1", status: "pending_assignment" }),
        bookingRow({ id: "c-1", status: "confirmed" }),
      ],
      1,
    );
    stubEnrichmentTables(client);
    createSupabaseServerClientMock.mockResolvedValue(client);

    const { listAdminBookings } = await import("./adminOperationsReadModel");
    const result = await listAdminBookings(adminUser, { filter: "pending_assignment" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bookings).toHaveLength(1);
    expect(result.bookings[0]?.status).toBe("pending_assignment");
    expect(result.matchTotal).toBe(1);
  });

  it("applies scheduled_start range in SQL", async () => {
    const client = createBookingsClient(
      [
        bookingRow({ id: "in-range", scheduled_start: "2026-05-15T12:00:00.000Z" }),
        bookingRow({ id: "out-range", scheduled_start: "2026-06-02T12:00:00.000Z" }),
      ],
      1,
    );
    stubEnrichmentTables(client);
    createSupabaseServerClientMock.mockResolvedValue(client);

    const { listAdminBookings } = await import("./adminOperationsReadModel");
    const result = await listAdminBookings(adminUser, {
      scheduledFrom: "2026-05-01",
      scheduledTo: "2026-05-31",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(client.listCalls.some((c) => c.method === "gte")).toBe(true);
    expect(client.listCalls.some((c) => c.method === "lt")).toBe(true);
    expect(result.bookings.map((b) => b.id)).toEqual(["in-range"]);
    expect(result.matchTotal).toBe(1);
  });

  it("sets capped when matchTotal exceeds returnedCount", async () => {
    const failedRows = Array.from({ length: ADMIN_BOOKINGS_LIST_LIMIT }, (_, i) =>
      bookingRow({
        id: `failed-${i}`,
        status: "payment_failed",
        updated_at: `2026-05-${String(i + 1).padStart(2, "0")}T10:00:00.000Z`,
      }),
    );
    const client = createBookingsClient(failedRows, 482);
    stubEnrichmentTables(client);
    createSupabaseServerClientMock.mockResolvedValue(client);

    const { listAdminBookings } = await import("./adminOperationsReadModel");
    const result = await listAdminBookings(adminUser, { filter: "payment_failed" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.returnedCount).toBe(ADMIN_BOOKINGS_LIST_LIMIT);
    expect(result.matchTotal).toBe(482);
    expect(result.capped).toBe(true);
  });

  it("applies q by booking id prefix in SQL before limit", async () => {
    const client = createBookingsClient(
      [
        bookingRow({ id: "550e8400-e29b-41d4-a716-446655440000" }),
        bookingRow({ id: "other-booking-id" }),
      ],
      1,
    );
    stubEnrichmentTables(client);
    createSupabaseServerClientMock.mockResolvedValue(client);

    const { listAdminBookings } = await import("./adminOperationsReadModel");
    const result = await listAdminBookings(adminUser, { search: "550e8400-e29b" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(client.listCalls.some((c) => c.method === "or")).toBe(true);
    expect(result.bookings).toHaveLength(1);
    expect(result.bookings[0]?.id).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(result.matchTotal).toBe(1);
    expect(result.subsetFiltered).toBeUndefined();
  });

  it("applies q by customer company name in SQL before limit", async () => {
    const client = createBookingsClient(
      [
        bookingRow({ id: "booking-acme", customer_id: "cust-acme" }),
        bookingRow({ id: "booking-other", customer_id: "cust-other" }),
      ],
      1,
      { customers: [{ id: "cust-acme", company_name: "Acme Holdings" }] },
    );
    stubEnrichmentTables(client);
    createSupabaseServerClientMock.mockResolvedValue(client);

    const { listAdminBookings } = await import("./adminOperationsReadModel");
    const result = await listAdminBookings(adminUser, { search: "acme" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bookings.map((b) => b.id)).toEqual(["booking-acme"]);
    expect(result.matchTotal).toBe(1);
  });

  it("applies q by payment provider ref in SQL before limit", async () => {
    const client = createBookingsClient(
      [
        bookingRow({ id: "booking-pay" }),
        bookingRow({ id: "booking-plain" }),
      ],
      1,
      { payments: [{ booking_id: "booking-pay", provider_ref: "paystack_tx_abc123" }] },
    );
    stubEnrichmentTables(client);
    createSupabaseServerClientMock.mockResolvedValue(client);

    const { listAdminBookings } = await import("./adminOperationsReadModel");
    const result = await listAdminBookings(adminUser, { search: "paystack_tx" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bookings.map((b) => b.id)).toEqual(["booking-pay"]);
    expect(result.matchTotal).toBe(1);
  });

  it("combines q with payment_failed and date range in SQL", async () => {
    const client = createBookingsClient(
      [
        bookingRow({
          id: "match",
          status: "payment_failed",
          customer_id: "cust-acme",
          scheduled_start: "2026-05-10T08:00:00.000Z",
        }),
        bookingRow({
          id: "wrong-status",
          status: "confirmed",
          customer_id: "cust-acme",
          scheduled_start: "2026-05-10T08:00:00.000Z",
        }),
      ],
      1,
      { customers: [{ id: "cust-acme", company_name: "Acme Holdings" }] },
    );
    stubEnrichmentTables(client);
    createSupabaseServerClientMock.mockResolvedValue(client);

    const { listAdminBookings } = await import("./adminOperationsReadModel");
    const result = await listAdminBookings(adminUser, {
      filter: "payment_failed",
      search: "acme",
      scheduledFrom: "2026-05-01",
      scheduledTo: "2026-05-31",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(client.listCalls.some((c) => c.method === "eq" && c.args[1] === "payment_failed")).toBe(
      true,
    );
    expect(client.listCalls.some((c) => c.method === "or")).toBe(true);
    expect(result.bookings.map((b) => b.id)).toEqual(["match"]);
    expect(result.matchTotal).toBe(1);
  });

  it("ignores q shorter than 3 characters without expensive search", async () => {
    const client = createBookingsClient([
      bookingRow({ id: "booking-1" }),
      bookingRow({ id: "booking-2" }),
    ]);
    stubEnrichmentTables(client);
    createSupabaseServerClientMock.mockResolvedValue(client);

    const { listAdminBookings } = await import("./adminOperationsReadModel");
    const result = await listAdminBookings(adminUser, { search: "ab" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(client.listCalls.some((c) => c.method === "or")).toBe(false);
    expect(result.bookings).toHaveLength(2);
    expect(result.matchTotal).toBeNull();
  });

  it("applies max_attempts filter in SQL before limit", async () => {
    const client = createBookingsClient(
      [
        bookingRow({
          id: "max-1",
          status: "pending_assignment",
          metadata: assignmentMeta({
            path: "best_available",
            reason: "Reached maximum assignment dispatch attempts for this booking.",
          }),
        }),
        bookingRow({ id: "other-1", status: "pending_assignment", metadata: assignmentMeta() }),
      ],
      1,
      { activeAssignmentFilter: "max_attempts" },
    );
    stubEnrichmentTables(client);
    createSupabaseServerClientMock.mockResolvedValue(client);

    const { listAdminBookings } = await import("./adminOperationsReadModel");
    const result = await listAdminBookings(adminUser, { filter: "max_attempts" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(client.listCalls.some((c) => c.method === "filter")).toBe(true);
    expect(result.bookings).toHaveLength(1);
    expect(result.matchTotal).toBe(1);
    expect(result.subsetFiltered).toBeUndefined();
  });

  it("applies selected_declined filter in SQL before limit", async () => {
    const client = createBookingsClient(
      [
        bookingRow({
          id: "sel-1",
          status: "pending_assignment",
          metadata: assignmentMeta({
            path: "selected",
            lastOfferOutcome: "declined",
          }),
        }),
        bookingRow({
          id: "other-1",
          status: "pending_assignment",
          metadata: assignmentMeta({ path: "best_available" }),
        }),
      ],
      1,
      { activeAssignmentFilter: "selected_declined" },
    );
    stubEnrichmentTables(client);
    createSupabaseServerClientMock.mockResolvedValue(client);

    const { listAdminBookings } = await import("./adminOperationsReadModel");
    const result = await listAdminBookings(adminUser, { filter: "selected_declined" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(client.listCalls.some((c) => c.method === "or")).toBe(true);
    expect(result.bookings.map((b) => b.id)).toEqual(["sel-1"]);
    expect(result.matchTotal).toBe(1);
    expect(result.subsetFiltered).toBeUndefined();
  });

  it("combines selected_declined with q and date range in SQL", async () => {
    const client = createBookingsClient(
      [
        bookingRow({
          id: "sel-match",
          status: "pending_assignment",
          customer_id: "cust-acme",
          scheduled_start: "2026-05-12T08:00:00.000Z",
          metadata: assignmentMeta({
            path: "selected",
            lastOfferOutcome: "declined",
          }),
        }),
        bookingRow({
          id: "sel-out",
          status: "pending_assignment",
          scheduled_start: "2026-06-01T08:00:00.000Z",
          metadata: assignmentMeta({ path: "selected", lastOfferOutcome: "declined" }),
        }),
      ],
      1,
      {
        activeAssignmentFilter: "selected_declined",
        customers: [{ id: "cust-acme", company_name: "Acme Holdings" }],
      },
    );
    stubEnrichmentTables(client);
    createSupabaseServerClientMock.mockResolvedValue(client);

    const { listAdminBookings } = await import("./adminOperationsReadModel");
    const result = await listAdminBookings(adminUser, {
      filter: "selected_declined",
      search: "acme",
      scheduledFrom: "2026-05-01",
      scheduledTo: "2026-05-31",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bookings.map((b) => b.id)).toEqual(["sel-match"]);
    expect(result.matchTotal).toBe(1);
    expect(result.subsetFiltered).toBeUndefined();
  });

  it("combines max_attempts with date range in SQL", async () => {
    const client = createBookingsClient(
      [
        bookingRow({
          id: "max-in",
          status: "pending_assignment",
          scheduled_start: "2026-05-10T08:00:00.000Z",
          metadata: assignmentMeta({
            reason: "Reached maximum assignment dispatch attempts for this booking.",
            path: "best_available",
          }),
        }),
        bookingRow({
          id: "max-out",
          status: "pending_assignment",
          scheduled_start: "2026-06-05T08:00:00.000Z",
          metadata: assignmentMeta({
            reason: "Reached maximum assignment dispatch attempts for this booking.",
          }),
        }),
      ],
      1,
      { activeAssignmentFilter: "max_attempts" },
    );
    stubEnrichmentTables(client);
    createSupabaseServerClientMock.mockResolvedValue(client);

    const { listAdminBookings } = await import("./adminOperationsReadModel");
    const result = await listAdminBookings(adminUser, {
      filter: "max_attempts",
      scheduledFrom: "2026-05-01",
      scheduledTo: "2026-05-31",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bookings.map((b) => b.id)).toEqual(["max-in"]);
    expect(result.matchTotal).toBe(1);
  });

  it("applies dispatch_not_started filter in SQL before limit", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-18T12:00:00.000Z"));
    const now = new Date("2026-05-18T12:00:00.000Z");
    const client = createBookingsClient(
      [
        bookingRow({
          id: "dispatch-1",
          status: "confirmed",
          metadata: assignmentMeta({
            status: "attention_required",
            reason: "Paid but dispatch not started; assignment recovery pending.",
          }),
        }),
        bookingRow({ id: "other-1", status: "pending_assignment" }),
      ],
      1,
      {
        activeAssignmentFilter: "dispatch_not_started",
        dispatchFilterNow: now,
        recoveryPayments: [],
        recoveryOffers: [],
      },
    );
    stubEnrichmentTables(client);
    createSupabaseServerClientMock.mockResolvedValue(client);

    const { listAdminBookings } = await import("./adminOperationsReadModel");
    const result = await listAdminBookings(adminUser, { filter: "dispatch_not_started" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(client.listCalls.some((c) => c.method === "or")).toBe(true);
    expect(result.bookings.map((b) => b.id)).toEqual(["dispatch-1"]);
    expect(result.matchTotal).toBe(1);
    expect(result.subsetFiltered).toBeUndefined();
    vi.useRealTimers();
  });

  it("finds dispatch_not_started recovery candidate outside newest 200 rows", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-18T12:00:00.000Z"));
    const now = new Date("2026-05-18T12:00:00.000Z");
    const paidAt = "2026-05-18T10:00:00.000Z";
    const recentNoise = Array.from({ length: 200 }, (_, i) =>
      bookingRow({
        id: `noise-${i}`,
        status: "completed",
        updated_at: `2026-05-20T${String((i % 23) + 1).padStart(2, "0")}:00:00.000Z`,
      }),
    );
    const stuck = bookingRow({
      id: "stuck-dispatch",
      status: "confirmed",
      updated_at: "2026-05-01T08:00:00.000Z",
    });
    const client = createBookingsClient([...recentNoise, stuck], 1, {
      activeAssignmentFilter: "dispatch_not_started",
      dispatchFilterNow: now,
      recoveryPayments: [
        {
          booking_id: "stuck-dispatch",
          status: "paid",
          updated_at: paidAt,
          created_at: paidAt,
        },
      ],
      paymentsByBooking: {
        "stuck-dispatch": [{ status: "paid", updated_at: paidAt, created_at: paidAt }],
      },
    });
    stubEnrichmentTables(client);
    createSupabaseServerClientMock.mockResolvedValue(client);

    const { listAdminBookings } = await import("./adminOperationsReadModel");
    const result = await listAdminBookings(adminUser, { filter: "dispatch_not_started" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bookings.map((b) => b.id)).toEqual(["stuck-dispatch"]);
    expect(result.matchTotal).toBe(1);
    expect(result.subsetFiltered).toBeUndefined();
    vi.useRealTimers();
  });

  it("combines dispatch_not_started with q and date range in SQL", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-18T12:00:00.000Z"));
    const now = new Date("2026-05-18T12:00:00.000Z");
    const client = createBookingsClient(
      [
        bookingRow({
          id: "dispatch-match",
          status: "confirmed",
          customer_id: "cust-acme",
          scheduled_start: "2026-05-12T08:00:00.000Z",
          metadata: assignmentMeta({
            status: "attention_required",
            reason: "Paid but dispatch not started; assignment recovery pending.",
          }),
        }),
        bookingRow({
          id: "dispatch-out-of-range",
          status: "confirmed",
          scheduled_start: "2026-06-01T08:00:00.000Z",
          metadata: assignmentMeta({
            status: "attention_required",
            reason: "Paid but dispatch not started; assignment recovery pending.",
          }),
        }),
      ],
      1,
      {
        activeAssignmentFilter: "dispatch_not_started",
        dispatchFilterNow: now,
        customers: [{ id: "cust-acme", company_name: "Acme Holdings" }],
        recoveryPayments: [],
      },
    );
    stubEnrichmentTables(client);
    createSupabaseServerClientMock.mockResolvedValue(client);

    const { listAdminBookings } = await import("./adminOperationsReadModel");
    const result = await listAdminBookings(adminUser, {
      filter: "dispatch_not_started",
      search: "acme",
      scheduledFrom: "2026-05-01",
      scheduledTo: "2026-05-31",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bookings.map((b) => b.id)).toEqual(["dispatch-match"]);
    expect(result.matchTotal).toBe(1);
    expect(result.subsetFiltered).toBeUndefined();
    vi.useRealTimers();
  });

  it("applies recovery_needed filter in SQL before limit", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-18T12:00:00.000Z"));
    const paidAt = "2026-05-18T10:00:00.000Z";
    const client = createBookingsClient(
      [
        bookingRow({
          id: "recovery-1",
          status: "confirmed",
          metadata: assignmentMeta({
            status: "attention_required",
            reason: "Paid but dispatch not started; assignment recovery pending.",
          }),
        }),
        bookingRow({ id: "other-1", status: "completed" }),
      ],
      1,
      {
        activeAssignmentFilter: "recovery_needed",
        dispatchFilterNow: new Date("2026-05-18T12:00:00.000Z"),
        recoveryPayments: [],
      },
    );
    stubEnrichmentTables(client);
    createSupabaseServerClientMock.mockResolvedValue(client);

    const { listAdminBookings } = await import("./adminOperationsReadModel");
    const result = await listAdminBookings(adminUser, { filter: "recovery_needed" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(client.listCalls.some((c) => c.method === "or")).toBe(true);
    expect(result.bookings.map((b) => b.id)).toEqual(["recovery-1"]);
    expect(result.matchTotal).toBe(1);
    expect(result.subsetFiltered).toBeUndefined();
    vi.useRealTimers();
  });

  it("recovery_needed uses same match set as dispatch_not_started in SQL", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-18T12:00:00.000Z"));
    const now = new Date("2026-05-18T12:00:00.000Z");
    const paidAt = "2026-05-18T10:00:00.000Z";
    const rows = [
      bookingRow({
        id: "candidate-1",
        status: "confirmed",
        updated_at: "2026-05-01T08:00:00.000Z",
      }),
      bookingRow({ id: "noise-1", status: "completed" }),
    ];
    const fixture = {
      activeAssignmentFilter: "recovery_needed" as const,
      dispatchFilterNow: now,
      recoveryPayments: [
        {
          booking_id: "candidate-1",
          status: "paid",
          updated_at: paidAt,
          created_at: paidAt,
        },
      ],
      paymentsByBooking: {
        "candidate-1": [{ status: "paid", updated_at: paidAt, created_at: paidAt }],
      },
    };

    const recoveryClient = createBookingsClient(rows, 1, {
      ...fixture,
      activeAssignmentFilter: "recovery_needed",
    });
    stubEnrichmentTables(recoveryClient);
    createSupabaseServerClientMock.mockResolvedValue(recoveryClient);

    const { listAdminBookings } = await import("./adminOperationsReadModel");
    const recoveryResult = await listAdminBookings(adminUser, { filter: "recovery_needed" });

    const dispatchClient = createBookingsClient(rows, 1, {
      ...fixture,
      activeAssignmentFilter: "dispatch_not_started",
    });
    stubEnrichmentTables(dispatchClient);
    createSupabaseServerClientMock.mockResolvedValue(dispatchClient);

    const dispatchResult = await listAdminBookings(adminUser, { filter: "dispatch_not_started" });

    expect(recoveryResult.ok).toBe(true);
    expect(dispatchResult.ok).toBe(true);
    if (!recoveryResult.ok || !dispatchResult.ok) return;
    expect(recoveryResult.bookings.map((b) => b.id)).toEqual(["candidate-1"]);
    expect(dispatchResult.bookings.map((b) => b.id)).toEqual(["candidate-1"]);
    expect(recoveryResult.matchTotal).toBe(dispatchResult.matchTotal);
  });

  it("combines recovery_needed with q and date range in SQL", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-18T12:00:00.000Z"));
    const client = createBookingsClient(
      [
        bookingRow({
          id: "recovery-match",
          status: "confirmed",
          customer_id: "cust-acme",
          scheduled_start: "2026-05-12T08:00:00.000Z",
          metadata: assignmentMeta({
            status: "attention_required",
            reason: "Paid but dispatch not started; assignment recovery pending.",
          }),
        }),
        bookingRow({
          id: "recovery-out",
          status: "confirmed",
          scheduled_start: "2026-06-01T08:00:00.000Z",
          metadata: assignmentMeta({
            status: "attention_required",
            reason: "Paid but dispatch not started; assignment recovery pending.",
          }),
        }),
      ],
      1,
      {
        activeAssignmentFilter: "recovery_needed",
        dispatchFilterNow: new Date("2026-05-18T12:00:00.000Z"),
        customers: [{ id: "cust-acme", company_name: "Acme Holdings" }],
        recoveryPayments: [],
      },
    );
    stubEnrichmentTables(client);
    createSupabaseServerClientMock.mockResolvedValue(client);

    const { listAdminBookings } = await import("./adminOperationsReadModel");
    const result = await listAdminBookings(adminUser, {
      filter: "recovery_needed",
      search: "acme",
      scheduledFrom: "2026-05-01",
      scheduledTo: "2026-05-31",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bookings.map((b) => b.id)).toEqual(["recovery-match"]);
    expect(result.matchTotal).toBe(1);
    expect(result.subsetFiltered).toBeUndefined();
    vi.useRealTimers();
  });

  it("applies assignment_attention filter in SQL before limit", async () => {
    const client = createBookingsClient(
      [
        bookingRow({
          id: "attention-1",
          status: "pending_assignment",
          metadata: assignmentMeta({ path: "best_available", status: "attention_required" }),
        }),
        bookingRow({ id: "other-1", status: "completed" }),
      ],
      1,
      { activeAssignmentFilter: "assignment_attention" },
    );
    stubEnrichmentTables(client);
    createSupabaseServerClientMock.mockResolvedValue(client);

    const { listAdminBookings } = await import("./adminOperationsReadModel");
    const result = await listAdminBookings(adminUser, { filter: "assignment_attention" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(client.listCalls.some((c) => c.method === "or")).toBe(true);
    expect(result.bookings.map((b) => b.id)).toEqual(["attention-1"]);
    expect(result.matchTotal).toBe(1);
    expect(result.subsetFiltered).toBeUndefined();
  });

  it("combines assignment_attention with q and date range in SQL", async () => {
    const client = createBookingsClient(
      [
        bookingRow({
          id: "attn-match",
          status: "pending_assignment",
          customer_id: "cust-acme",
          scheduled_start: "2026-05-12T08:00:00.000Z",
          metadata: assignmentMeta({ path: "best_available", status: "attention_required" }),
        }),
        bookingRow({
          id: "attn-outside-range",
          status: "pending_assignment",
          customer_id: "cust-acme",
          scheduled_start: "2026-04-01T08:00:00.000Z",
          metadata: assignmentMeta({ path: "best_available", status: "attention_required" }),
        }),
      ],
      1,
      {
        activeAssignmentFilter: "assignment_attention",
        customers: [{ id: "cust-acme", company_name: "Acme Holdings" }],
      },
    );
    stubEnrichmentTables(client);
    createSupabaseServerClientMock.mockResolvedValue(client);

    const { listAdminBookings } = await import("./adminOperationsReadModel");
    const result = await listAdminBookings(adminUser, {
      filter: "assignment_attention",
      search: "acme",
      scheduledFrom: "2026-05-01",
      scheduledTo: "2026-05-31",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bookings.map((b) => b.id)).toEqual(["attn-match"]);
    expect(result.matchTotal).toBe(1);
    expect(result.subsetFiltered).toBeUndefined();
  });
});
