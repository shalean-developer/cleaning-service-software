import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/types";
import { ADMIN_OPERATIONAL_QUEUES } from "@/features/dashboards/adminOperationalQueues";
import type {
  DispatchFilterOffer,
  DispatchFilterPayment,
} from "./adminAssignmentFilterSql";
import {
  countAdminBookingsByFilter,
  getAdminOperationalQueueCounts,
} from "./adminOperationalQueueCounts";

const createSupabaseServerClientMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => createSupabaseServerClientMock(),
}));

const adminUser: CurrentUser = {
  profileId: "profile-admin",
  role: "admin",
  authUser: { id: "auth-admin" } as CurrentUser["authUser"],
};

type BookingRow = { id: string; status: string; scheduled_start: string };

type PrefetchResult<T> = { data: T; error: null };

const EMPTY_DISPATCH_PAYMENTS: DispatchFilterPayment[] = [];
const EMPTY_DISPATCH_OFFERS: DispatchFilterOffer[] = [];

function prefetchResult<T>(data: T): PrefetchResult<T> {
  return { data, error: null };
}

function createCountOnlyClient(rows: BookingRow[]) {
  const countCalls: { method: string; args: unknown[] }[] = [];
  const countBuilder = {
    select: vi.fn((...args: unknown[]) => {
      countCalls.push({ method: "select", args });
      return countBuilder;
    }),
    eq: vi.fn((...args: unknown[]) => {
      countCalls.push({ method: "eq", args });
      return countBuilder;
    }),
    gte: vi.fn(() => countBuilder),
    lt: vi.fn(() => countBuilder),
    or: vi.fn(() => countBuilder),
    in: vi.fn(() => countBuilder),
    filter: vi.fn(() => countBuilder),
    then: (
      onFulfilled: (v: { count: number; error: null }) => unknown,
      onRejected?: (e: unknown) => unknown,
    ) => {
      let filtered = [...rows];
      for (const call of countCalls) {
        if (call.method === "eq" && call.args[0] === "status") {
          filtered = filtered.filter((r) => r.status === call.args[1]);
        }
      }
      return Promise.resolve({ count: filtered.length, error: null }).then(onFulfilled, onRejected);
    },
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "payments") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => prefetchResult(EMPTY_DISPATCH_PAYMENTS)),
          })),
        };
      }
      if (table === "assignment_offers") {
        const emptyOffers = prefetchResult(EMPTY_DISPATCH_OFFERS);
        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => emptyOffers),
            then: (
              onFulfilled: (v: PrefetchResult<DispatchFilterOffer[]>) => unknown,
              onRejected?: (e: unknown) => unknown,
            ) => Promise.resolve(emptyOffers).then(onFulfilled, onRejected),
          })),
        };
      }
      if (table !== "bookings") {
        throw new Error(`unexpected table ${table}`);
      }
      return {
        select: vi.fn((_columns: string, options?: { count: "exact"; head: true }) => {
          if (options?.count === "exact") return countBuilder;
          throw new Error("list select not expected in count-only tests");
        }),
      };
    }),
    countCalls,
  };
}

describe("adminOperationalQueueCounts (7A-1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("countAdminBookingsByFilter uses head count for status filters", async () => {
    const client = createCountOnlyClient([
      { id: "a", status: "payment_failed", scheduled_start: "2026-05-20T08:00:00.000Z" },
      { id: "b", status: "payment_failed", scheduled_start: "2026-05-21T08:00:00.000Z" },
      { id: "c", status: "confirmed", scheduled_start: "2026-05-22T08:00:00.000Z" },
    ]);
    createSupabaseServerClientMock.mockResolvedValue(client);

    const count = await countAdminBookingsByFilter(client as never, "payment_failed");
    expect(count).toBe(2);
  });

  it("getAdminOperationalQueueCounts returns all operational queues with deep links", async () => {
    const client = createCountOnlyClient([
      { id: "pa", status: "pending_assignment", scheduled_start: "2026-05-20T08:00:00.000Z" },
      { id: "pf", status: "payment_failed", scheduled_start: "2026-05-21T08:00:00.000Z" },
    ]);
    createSupabaseServerClientMock.mockResolvedValue(client);

    const result = await getAdminOperationalQueueCounts(adminUser);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.queues).toHaveLength(ADMIN_OPERATIONAL_QUEUES.length);
    for (const def of ADMIN_OPERATIONAL_QUEUES) {
      const item = result.queues.find((q) => q.key === def.key);
      expect(item).toBeDefined();
      expect(item?.label).toBe(def.label);
      expect(item?.href).toBe(`/admin/bookings?filter=${def.filter}`);
      expect(item?.tone).toBe(def.tone);
    }
  });

  it("rejects non-admin callers", async () => {
    const result = await getAdminOperationalQueueCounts({
      ...adminUser,
      role: "customer",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("FORBIDDEN");
  });
});
