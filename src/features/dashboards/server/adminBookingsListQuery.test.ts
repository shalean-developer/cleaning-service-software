import { describe, expect, it, vi } from "vitest";
import {
  applyAdminBookingsSearchSql,
  applyAdminBookingsSqlFilters,
  escapeIlikePattern,
  hasHonestMatchTotal,
  hasServerSideSearch,
  hasServerSideSqlFilters,
  isBookingIdPrefixSearch,
  MIN_ADMIN_BOOKING_SEARCH_LENGTH,
  needsInMemoryRefinement,
  isAdminBookingSearchIgnored,
  normalizeAdminBookingSearch,
  normalizeAdminBookingsQuery,
  resolveAdminBookingsSearchSql,
  scheduledFromInclusiveLower,
  scheduledToExclusiveUpper,
  SERVER_SIDE_STATUS_FILTERS,
} from "./adminBookingsListQuery";

function mockBuilder() {
  const calls: { method: string; args: unknown[] }[] = [];
  const builder = {
    select: vi.fn((...args: unknown[]) => {
      calls.push({ method: "select", args });
      return builder;
    }),
    eq: vi.fn((...args: unknown[]) => {
      calls.push({ method: "eq", args });
      return builder;
    }),
    gte: vi.fn((...args: unknown[]) => {
      calls.push({ method: "gte", args });
      return builder;
    }),
    lt: vi.fn((...args: unknown[]) => {
      calls.push({ method: "lt", args });
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
    filter: vi.fn((...args: unknown[]) => {
      calls.push({ method: "filter", args });
      return builder;
    }),
  };
  return { builder, calls };
}

function mockSupabaseForSearch(input: {
  customers?: { id: string; company_name: string }[];
  payments?: { booking_id: string; provider_ref: string }[];
}) {
  const customers = input.customers ?? [];
  const payments = input.payments ?? [];
  return {
    from: vi.fn((table: string) => {
      if (table === "customers") {
        return {
          select: vi.fn(() => ({
            ilike: vi.fn(async (_col: string, pattern: string) => ({
              data: customers.filter((c) =>
                c.company_name.toLowerCase().includes(pattern.replace(/%/g, "").toLowerCase()),
              ),
              error: null,
            })),
          })),
        };
      }
      if (table === "payments") {
        return {
          select: vi.fn(() => ({
            not: vi.fn(() => ({
              ilike: vi.fn(async (_col: string, pattern: string) => ({
                data: payments.filter((p) =>
                  p.provider_ref.toLowerCase().includes(pattern.replace(/%/g, "").toLowerCase()),
                ),
                error: null,
              })),
            })),
          })),
        };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };
}

describe("adminBookingsListQuery", () => {
  it("exposes server-side status filters for 6C-1", () => {
    expect([...SERVER_SIDE_STATUS_FILTERS]).toEqual(["payment_failed", "pending_assignment"]);
  });

  it("requires minimum search length", () => {
    expect(MIN_ADMIN_BOOKING_SEARCH_LENGTH).toBe(3);
    expect(normalizeAdminBookingSearch("ab")).toBeUndefined();
    expect(normalizeAdminBookingSearch("abc")).toBe("abc");
  });

  it("escapes ILIKE metacharacters", () => {
    expect(escapeIlikePattern("100%_off")).toBe("100\\%\\_off");
  });

  it("detects booking id prefix searches", () => {
    expect(isBookingIdPrefixSearch("550e8400")).toBe(true);
    expect(isBookingIdPrefixSearch("550e8400-e29b")).toBe(true);
    expect(isBookingIdPrefixSearch("ab")).toBe(false);
    expect(isBookingIdPrefixSearch("acme")).toBe(false);
  });

  it("scheduledToExclusiveUpper is start of next UTC day", () => {
    expect(scheduledToExclusiveUpper("2026-05-31")).toBe("2026-06-01T00:00:00.000Z");
    expect(scheduledFromInclusiveLower("2026-05-01")).toBe("2026-05-01T00:00:00.000Z");
  });

  it("ignores invalid schedule date params", () => {
    expect(normalizeAdminBookingsQuery({ scheduledFrom: "not-a-date" }).scheduledFrom).toBeUndefined();
    expect(normalizeAdminBookingsQuery({ scheduledTo: "2026-13-40" }).scheduledTo).toBeUndefined();
    expect(normalizeAdminBookingsQuery({ search: "ab" }).search).toBeUndefined();
  });

  it("isAdminBookingSearchIgnored when q is present but below minimum length", () => {
    expect(isAdminBookingSearchIgnored("ab")).toBe(true);
    expect(isAdminBookingSearchIgnored("  x ")).toBe(true);
    expect(isAdminBookingSearchIgnored("abc")).toBe(false);
    expect(isAdminBookingSearchIgnored(undefined)).toBe(false);
  });

  it("applyAdminBookingsSqlFilters chains status and schedule predicates", () => {
    const { builder, calls } = mockBuilder();
    applyAdminBookingsSqlFilters(builder, {
      filter: "payment_failed",
      scheduledFrom: "2026-05-01",
      scheduledTo: "2026-05-31",
    });
    expect(calls).toEqual([
      { method: "eq", args: ["status", "payment_failed"] },
      { method: "gte", args: ["scheduled_start", "2026-05-01T00:00:00.000Z"] },
      { method: "lt", args: ["scheduled_start", "2026-06-01T00:00:00.000Z"] },
    ]);
  });

  it("applyAdminBookingsSearchSql uses or or force-empty in", () => {
    const { builder: withOr, calls: orCalls } = mockBuilder();
    applyAdminBookingsSearchSql(withOr, { orFilter: "id.ilike.abc%" });
    expect(orCalls).toEqual([{ method: "or", args: ["id.ilike.abc%"] }]);

    const { builder: empty, calls: emptyCalls } = mockBuilder();
    applyAdminBookingsSearchSql(empty, { forceEmpty: true });
    expect(emptyCalls[0]?.method).toBe("in");
  });

  it("resolveAdminBookingsSearchSql builds OR from customers and payments", async () => {
    const client = mockSupabaseForSearch({
      customers: [{ id: "cust-acme", company_name: "Acme Holdings" }],
      payments: [{ booking_id: "booking-pay", provider_ref: "paystack_tx_abc123" }],
    });

    const sql = await resolveAdminBookingsSearchSql(client as never, { search: "acme" });
    expect(sql.orFilter).toContain("customer_id.in.(cust-acme)");

    const refSql = await resolveAdminBookingsSearchSql(client as never, {
      search: "paystack",
    });
    expect(refSql.orFilter).toContain("id.in.(booking-pay)");
  });

  it("resolveAdminBookingsSearchSql includes id prefix clause for UUID-like q", async () => {
    const client = mockSupabaseForSearch({});
    const sql = await resolveAdminBookingsSearchSql(client as never, {
      search: "550e8400-e29b",
    });
    expect(sql.orFilter).toContain("id.ilike.");
  });

  it("resolveAdminBookingsSearchSql force-empty when nothing matches", async () => {
    const client = mockSupabaseForSearch({});
    const sql = await resolveAdminBookingsSearchSql(client as never, { search: "zzznone" });
    expect(sql.forceEmpty).toBe(true);
  });

  it("classifies server-side vs in-memory refinement", () => {
    expect(hasServerSideSqlFilters({ filter: "payment_failed" })).toBe(true);
    expect(hasServerSideSqlFilters({ search: "acme" })).toBe(true);
    expect(hasServerSideSearch({ search: "ab" })).toBe(false);
    expect(hasServerSideSqlFilters({ filter: "max_attempts" })).toBe(true);
    expect(hasServerSideSqlFilters({ filter: "selected_declined" })).toBe(true);
    expect(hasServerSideSqlFilters({ filter: "dispatch_not_started" })).toBe(true);
    expect(hasServerSideSqlFilters({ filter: "recovery_needed" })).toBe(true);

    expect(needsInMemoryRefinement({ filter: "assignment_attention" })).toBe(false);
    expect(needsInMemoryRefinement({ search: "acme" })).toBe(false);
    expect(needsInMemoryRefinement({ filter: "payment_failed" })).toBe(false);
    expect(needsInMemoryRefinement({ filter: "max_attempts" })).toBe(false);
    expect(needsInMemoryRefinement({ filter: "selected_declined" })).toBe(false);
    expect(needsInMemoryRefinement({ filter: "dispatch_not_started" })).toBe(false);
    expect(needsInMemoryRefinement({ filter: "recovery_needed" })).toBe(false);

    expect(hasHonestMatchTotal({ filter: "payment_failed" })).toBe(true);
    expect(hasHonestMatchTotal({ search: "acme" })).toBe(true);
    expect(hasHonestMatchTotal({ filter: "max_attempts" })).toBe(true);
    expect(hasHonestMatchTotal({ filter: "selected_declined", search: "acme" })).toBe(true);
    expect(hasHonestMatchTotal({ filter: "dispatch_not_started" })).toBe(true);
    expect(hasHonestMatchTotal({ filter: "recovery_needed" })).toBe(true);
    expect(hasHonestMatchTotal({ filter: "recovery_needed", search: "acme" })).toBe(true);
    expect(hasHonestMatchTotal({ filter: "assignment_attention" })).toBe(true);
    expect(hasHonestMatchTotal({ filter: "assignment_attention", search: "acme" })).toBe(true);
  });
});
