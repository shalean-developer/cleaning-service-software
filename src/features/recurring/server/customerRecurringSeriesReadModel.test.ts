import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/types";
import type { BookingSeriesRow } from "@/lib/database/types";

const createSupabaseServerClientMock = vi.fn();
const resolveActorScopeMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => createSupabaseServerClientMock(),
}));

vi.mock("@/lib/auth/resolveActorScope", () => ({
  resolveActorScope: (...args: unknown[]) => resolveActorScopeMock(...args),
}));

const customerUser: CurrentUser = {
  profileId: "profile-cust",
  role: "customer",
  authUser: { id: "auth-cust" } as CurrentUser["authUser"],
};

function seriesRow(overrides: Partial<BookingSeriesRow> = {}): BookingSeriesRow {
  return {
    id: overrides.id ?? "series-1",
    customer_id: overrides.customer_id ?? "cust-mine",
    user_id: "profile-cust",
    created_from_booking_id: "booking-anchor",
    frequency: "weekly",
    timezone: "Africa/Johannesburg",
    anchor_scheduled_start: "2026-05-01T08:00:00.000Z",
    next_occurrence_at: "2026-05-08T08:00:00.000Z",
    status: "active",
    template_metadata: {},
    service_slug: "standard-clean",
    price_cents: 50_000,
    created_at: "2026-05-01T08:00:00.000Z",
    updated_at: "2026-05-01T08:00:00.000Z",
    ...overrides,
  };
}

type Fixture = {
  actingCustomerId: string | null;
  seriesForCustomer: BookingSeriesRow[];
  seriesError?: { code?: string; message: string } | null;
};

function createClient(fixture: Fixture) {
  return {
    from(table: string) {
      if (table === "booking_series") {
        return {
          select: () => ({
            eq: (_col: string, customerId: string) => ({
              order: async () => {
                if (fixture.seriesError) {
                  return { data: null, error: fixture.seriesError };
                }
                const rows = fixture.seriesForCustomer.filter(
                  (s) => s.customer_id === customerId,
                );
                return { data: rows, error: null };
              },
            }),
          }),
        };
      }
      if (table === "bookings") {
        return {
          select: () => ({
            in: async () => ({ data: [], error: null }),
          }),
        };
      }
      if (table === "customers") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: fixture.actingCustomerId
                  ? { id: fixture.actingCustomerId }
                  : null,
                error: null,
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

describe("listCustomerRecurringSeries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveActorScopeMock.mockResolvedValue({ actingCustomerId: "cust-mine" });
  });

  it("returns only series owned by the resolved customer id", async () => {
    createSupabaseServerClientMock.mockResolvedValue(
      createClient({
        actingCustomerId: "cust-mine",
        seriesForCustomer: [
          seriesRow({ id: "mine", customer_id: "cust-mine" }),
          seriesRow({ id: "other", customer_id: "cust-other" }),
        ],
      }),
    );

    const { listCustomerRecurringSeries } = await import("./customerRecurringSeriesReadModel");
    const result = await listCustomerRecurringSeries(customerUser);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.series).toHaveLength(1);
    expect(result.series[0]?.seriesId).toBe("mine");
  });

  it("returns emptyReason when account owns no series", async () => {
    createSupabaseServerClientMock.mockResolvedValue(
      createClient({
        actingCustomerId: "cust-mine",
        seriesForCustomer: [seriesRow({ customer_id: "cust-other" })],
      }),
    );

    const { listCustomerRecurringSeries } = await import("./customerRecurringSeriesReadModel");
    const result = await listCustomerRecurringSeries(customerUser);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.series).toHaveLength(0);
    expect(result.emptyReason).toBe("none_for_account");
  });

  it("does not surface RLS block as an empty list", async () => {
    createSupabaseServerClientMock.mockResolvedValue(
      createClient({
        actingCustomerId: "cust-mine",
        seriesForCustomer: [],
        seriesError: { code: "42501", message: "permission denied for table booking_series" },
      }),
    );

    const { listCustomerRecurringSeries } = await import("./customerRecurringSeriesReadModel");
    const result = await listCustomerRecurringSeries(customerUser);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/permissions/i);
  });
});
