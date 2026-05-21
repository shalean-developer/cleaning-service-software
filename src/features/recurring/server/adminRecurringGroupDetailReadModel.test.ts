import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/types";
import type { BookingSeriesRow, RecurringScheduleGroupRow } from "@/lib/database/types";
import { ARCHIVED_CUSTOMER_LABEL } from "./recurringReadModelLabels";

const createSupabaseServerClientMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => createSupabaseServerClientMock(),
}));

vi.mock("@/features/dashboards/server/bookingCleanersReadModel", () => ({
  resolveCleanerLabels: async () => new Map(),
}));

const adminUser: CurrentUser = {
  profileId: "profile-admin",
  role: "admin",
  authUser: { id: "auth-admin" } as CurrentUser["authUser"],
};

function groupRow(overrides: Partial<RecurringScheduleGroupRow> = {}): RecurringScheduleGroupRow {
  return {
    id: overrides.id ?? "group-1",
    customer_id: overrides.customer_id ?? "cust-1",
    service_slug: "standard-clean",
    status: overrides.status ?? "active",
    frequency: "weekly",
    timezone: "Africa/Johannesburg",
    label: null,
    selected_days: [1, 3],
    anchor_booking_id: "anchor-paid",
    created_at: "2026-05-01T08:00:00.000Z",
    updated_at: "2026-05-01T08:00:00.000Z",
    ...overrides,
  };
}

function seriesRow(overrides: Partial<BookingSeriesRow> = {}): BookingSeriesRow {
  return {
    id: overrides.id ?? "series-mon",
    customer_id: overrides.customer_id ?? "cust-1",
    user_id: null,
    group_id: overrides.group_id ?? "group-1",
    weekday: overrides.weekday ?? 1,
    slot_label: overrides.slot_label ?? "Mon 08:00",
    created_from_booking_id: overrides.created_from_booking_id ?? "anchor-paid",
    frequency: "weekly",
    timezone: "Africa/Johannesburg",
    anchor_scheduled_start: "2026-05-01T08:00:00.000Z",
    next_occurrence_at: "2026-06-01T08:00:00.000Z",
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
  group: RecurringScheduleGroupRow;
  series: BookingSeriesRow[];
  customers?: { id: string; profile_id: string; company_name: string | null; phone: string | null }[];
  bookings?: Record<string, unknown>[];
  requests?: Record<string, unknown>[];
};

function createClient(fixture: Fixture) {
  const bookings = fixture.bookings ?? [];
  const requests = fixture.requests ?? [];
  return {
    from(table: string) {
      if (table === "recurring_schedule_groups") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: fixture.group, error: null }),
            }),
          }),
        };
      }
      if (table === "booking_series") {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: fixture.series, error: null }),
            }),
          }),
        };
      }
      if (table === "bookings") {
        return {
          select: () => ({
            in: () => ({
              order: async () => ({ data: bookings, error: null }),
            }),
          }),
        };
      }
      if (table === "payments") {
        return {
          select: () => ({
            in: async () => ({ data: [], error: null }),
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
      if (table === "recurring_series_requests") {
        return {
          select: () => ({
            in: () => ({
              order: async () => ({ data: requests, error: null }),
            }),
          }),
        };
      }
      if (table === "booking_state_audit") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: async () => ({ data: [], error: null }),
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

describe("getAdminRecurringScheduleGroupDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads linked weekday series", async () => {
    createSupabaseServerClientMock.mockResolvedValue(
      createClient({
        group: groupRow(),
        series: [
          seriesRow({ id: "series-mon", weekday: 1 }),
          seriesRow({ id: "series-wed", weekday: 3, created_from_booking_id: "syn-anchor" }),
        ],
        customers: [
          { id: "cust-1", profile_id: "p1", company_name: "Acme", phone: null },
        ],
        bookings: [
          {
            id: "child-1",
            series_id: "series-mon",
            status: "pending_payment",
            scheduled_start: "2026-06-01T08:00:00.000Z",
            scheduled_end: "2026-06-01T10:00:00.000Z",
            metadata: { recurring: { generated: true } },
            synthetic_anchor: false,
            price_cents: 50_000,
            cleaner_id: null,
          },
        ],
      }),
    );

    const { getAdminRecurringScheduleGroupDetail } = await import(
      "./adminRecurringGroupDetailReadModel"
    );
    const result = await getAdminRecurringScheduleGroupDetail(adminUser, "group-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.group.weekdaySeries).toHaveLength(2);
    expect(result.group.activeSeriesCount).toBe(2);
  });

  it("excludes synthetic anchors from timeline", async () => {
    createSupabaseServerClientMock.mockResolvedValue(
      createClient({
        group: groupRow(),
        series: [seriesRow()],
        bookings: [
          {
            id: "syn-1",
            series_id: "series-mon",
            status: "cancelled",
            scheduled_start: "2026-05-01T08:00:00.000Z",
            scheduled_end: "2026-05-01T10:00:00.000Z",
            metadata: { recurring: { syntheticAnchor: true } },
            synthetic_anchor: true,
            price_cents: 0,
            cleaner_id: null,
          },
          {
            id: "real-1",
            series_id: "series-mon",
            status: "confirmed",
            scheduled_start: "2026-06-01T08:00:00.000Z",
            scheduled_end: "2026-06-01T10:00:00.000Z",
            metadata: { recurring: { generated: true } },
            synthetic_anchor: false,
            price_cents: 50_000,
            cleaner_id: null,
          },
        ],
      }),
    );

    const { getAdminRecurringScheduleGroupDetail } = await import(
      "./adminRecurringGroupDetailReadModel"
    );
    const result = await getAdminRecurringScheduleGroupDetail(adminUser, "group-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.group.timeline.map((t) => t.bookingId)).toEqual(["real-1"]);
  });

  it("uses archived customer fallback when customer row is missing", async () => {
    createSupabaseServerClientMock.mockResolvedValue(
      createClient({
        group: groupRow({ customer_id: "missing-cust" }),
        series: [seriesRow({ customer_id: "missing-cust" })],
        bookings: [],
      }),
    );

    const { getAdminRecurringScheduleGroupDetail } = await import(
      "./adminRecurringGroupDetailReadModel"
    );
    const result = await getAdminRecurringScheduleGroupDetail(adminUser, "group-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.group.customerName).toBe(ARCHIVED_CUSTOMER_LABEL);
  });

  it("counts open requests and payment-required children", async () => {
    createSupabaseServerClientMock.mockResolvedValue(
      createClient({
        group: groupRow(),
        series: [seriesRow()],
        bookings: [
          {
            id: "unpaid-1",
            series_id: "series-mon",
            status: "pending_payment",
            scheduled_start: "2026-06-01T08:00:00.000Z",
            scheduled_end: "2026-06-01T10:00:00.000Z",
            metadata: { recurring: { generated: true } },
            synthetic_anchor: false,
            price_cents: 50_000,
            cleaner_id: null,
          },
        ],
        requests: [
          {
            id: "req-1",
            series_id: "series-mon",
            customer_id: "cust-1",
            request_type: "pause",
            note: "Please pause",
            status: "open",
            created_at: "2026-05-10T08:00:00.000Z",
            resolved_at: null,
            resolved_by: null,
            metadata: {},
          },
        ],
      }),
    );

    const { getAdminRecurringScheduleGroupDetail } = await import(
      "./adminRecurringGroupDetailReadModel"
    );
    const result = await getAdminRecurringScheduleGroupDetail(adminUser, "group-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.group.openCustomerRequestsCount).toBe(1);
    expect(result.group.unpaidChildVisits).toBe(1);
    expect(result.group.supportRequests.open).toHaveLength(1);
  });
});
