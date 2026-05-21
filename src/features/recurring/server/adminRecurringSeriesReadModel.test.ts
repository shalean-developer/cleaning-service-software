import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/types";
import type { BookingSeriesRow } from "@/lib/database/types";
import { ARCHIVED_CUSTOMER_LABEL } from "./recurringReadModelLabels";

const createSupabaseServerClientMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => createSupabaseServerClientMock(),
}));

const adminUser: CurrentUser = {
  profileId: "profile-admin",
  role: "admin",
  authUser: { id: "auth-admin" } as CurrentUser["authUser"],
};

function seriesRow(overrides: Partial<BookingSeriesRow> = {}): BookingSeriesRow {
  return {
    id: overrides.id ?? "series-1",
    customer_id: overrides.customer_id ?? "cust-1",
    user_id: null,
    created_from_booking_id: overrides.created_from_booking_id ?? "booking-anchor",
    frequency: "weekly",
    timezone: "Africa/Johannesburg",
    anchor_scheduled_start: "2026-05-01T08:00:00.000Z",
    next_occurrence_at: "2026-05-08T08:00:00.000Z",
    status: overrides.status ?? "active",
    template_metadata: {},
    service_slug: "standard-clean",
    price_cents: 50_000,
    created_at: "2026-05-01T08:00:00.000Z",
    updated_at: "2026-05-01T08:00:00.000Z",
    ...overrides,
  };
}

type Fixture = {
  series: BookingSeriesRow[];
  customers?: { id: string; profile_id: string; company_name: string | null; phone: string | null }[];
  bookings?: { id: string; series_id: string; status: string; scheduled_start: string }[];
  seriesError?: { code?: string; message: string } | null;
};

function createClient(fixture: Fixture) {
  const bookings = fixture.bookings ?? [];
  return {
    from(table: string) {
      if (table === "booking_series") {
        return {
          select: () => ({
            order: () => ({
              eq: (_col: string, status: string) => ({
                order: async () => {
                  if (fixture.seriesError) {
                    return { data: null, error: fixture.seriesError };
                  }
                  const rows = fixture.series.filter((s) => s.status === status);
                  return { data: rows, error: null };
                },
              }),
              async then(resolve: (v: unknown) => void) {
                if (fixture.seriesError) {
                  resolve({ data: null, error: fixture.seriesError });
                  return;
                }
                resolve({ data: fixture.series, error: null });
              },
            }),
          }),
        };
      }
      if (table === "bookings") {
        return {
          select: () => ({
            in: async () => ({ data: bookings, error: null }),
          }),
        };
      }
      if (table === "customers") {
        return {
          select: () => ({
            in: async () => ({ data: fixture.customers ?? [], error: null }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            in: async () => ({ data: [], error: null }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

describe("listAdminRecurringSeries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes series when customer row is missing (Archived customer)", async () => {
    createSupabaseServerClientMock.mockResolvedValue(
      createClient({
        series: [seriesRow({ customer_id: "cust-orphan" })],
        customers: [],
        bookings: [],
      }),
    );

    const { listAdminRecurringSeries } = await import("./adminRecurringSeriesReadModel");
    const result = await listAdminRecurringSeries(adminUser);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.series).toHaveLength(1);
    expect(result.series[0]?.customerName).toBe(ARCHIVED_CUSTOMER_LABEL);
  });

  it("includes active, paused, and cancelled when filter is unset (all)", async () => {
    createSupabaseServerClientMock.mockResolvedValue(
      createClient({
        series: [
          seriesRow({ id: "s-active", status: "active" }),
          seriesRow({ id: "s-paused", status: "paused" }),
          seriesRow({ id: "s-cancelled", status: "cancelled" }),
        ],
        customers: [{ id: "cust-1", profile_id: "p-1", company_name: "Acme", phone: null }],
      }),
    );

    const { listAdminRecurringSeries } = await import("./adminRecurringSeriesReadModel");
    const result = await listAdminRecurringSeries(adminUser);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.series.map((s) => s.status).sort()).toEqual(
      ["active", "cancelled", "paused"].sort(),
    );
  });

  it("does not surface RLS block as an empty list", async () => {
    createSupabaseServerClientMock.mockResolvedValue(
      createClient({
        series: [],
        seriesError: { code: "42501", message: "permission denied for table booking_series" },
      }),
    );

    const { listAdminRecurringSeries } = await import("./adminRecurringSeriesReadModel");
    const result = await listAdminRecurringSeries(adminUser);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/not readable/i);
    expect(result.series).toBeUndefined();
  });
});
