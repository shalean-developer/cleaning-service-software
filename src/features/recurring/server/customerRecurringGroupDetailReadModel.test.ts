import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/types";
import type { BookingSeriesRow, RecurringScheduleGroupRow } from "@/lib/database/types";

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

function groupRow(): RecurringScheduleGroupRow {
  return {
    id: "group-1",
    customer_id: "cust-1",
    service_slug: "standard-clean",
    status: "active",
    frequency: "weekly",
    timezone: "Africa/Johannesburg",
    label: null,
    selected_days: [1, 3, 5],
    anchor_booking_id: "anchor-paid",
    created_at: "2026-05-01T08:00:00.000Z",
    updated_at: "2026-05-01T08:00:00.000Z",
  };
}

function seriesRow(id: string, weekday: number): BookingSeriesRow {
  return {
    id,
    customer_id: "cust-1",
    user_id: null,
    group_id: "group-1",
    weekday,
    slot_label: `Day ${weekday}`,
    created_from_booking_id: "anchor-paid",
    frequency: "weekly",
    timezone: "Africa/Johannesburg",
    anchor_scheduled_start: "2026-05-01T08:00:00.000Z",
    next_occurrence_at: "2026-07-01T08:00:00.000Z",
    status: "active",
    template_metadata: {},
    service_slug: "standard-clean",
    price_cents: 50_000,
    created_at: "2026-05-01T08:00:00.000Z",
    updated_at: "2026-05-01T08:00:00.000Z",
  };
}

type Fixture = {
  group: RecurringScheduleGroupRow;
  series: BookingSeriesRow[];
  bookings: Record<string, unknown>[];
  requests: Record<string, unknown>[];
  customerId?: string;
};

function createClient(fixture: Fixture) {
  const customerId = fixture.customerId ?? "cust-1";
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
              order: async () => ({ data: fixture.bookings, error: null }),
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
      if (table === "recurring_series_requests") {
        return {
          select: () => ({
            or: () => ({
              order: async () => ({ data: fixture.requests, error: null }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

describe("getCustomerRecurringScheduleGroupDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveActorScopeMock.mockResolvedValue({ actingCustomerId: "cust-1" });
  });

  it("loads own group with visits and excludes synthetic anchors", async () => {
    const { getCustomerRecurringScheduleGroupDetail } = await import(
      "./customerRecurringGroupDetailReadModel"
    );
    createSupabaseServerClientMock.mockResolvedValue(
      createClient({
        group: groupRow(),
        series: [seriesRow("series-mon", 1), seriesRow("series-wed", 3)],
        bookings: [
          {
            id: "child-unpaid",
            series_id: "series-mon",
            status: "pending_payment",
            scheduled_start: "2026-07-01T08:00:00.000Z",
            scheduled_end: "2026-07-01T10:00:00.000Z",
            synthetic_anchor: false,
            metadata: { recurring: { generated: true } },
            price_cents: 50_000,
          },
          {
            id: "synthetic-mon",
            series_id: "series-mon",
            status: "confirmed",
            scheduled_start: "2026-06-01T08:00:00.000Z",
            scheduled_end: "2026-06-01T10:00:00.000Z",
            synthetic_anchor: true,
            metadata: {},
          },
        ],
        requests: [],
      }),
    );

    const result = await getCustomerRecurringScheduleGroupDetail(customerUser, "group-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.group.groupId).toBe("group-1");
    expect(result.group.weekdaySeries).toHaveLength(2);
    expect(result.group.upcomingVisits.some((v) => v.bookingId === "synthetic-mon")).toBe(
      false,
    );
    expect(result.group.upcomingVisits[0]?.paymentRequired).toBe(true);
    expect(result.group.upcomingVisits[0]?.bookingId).toBe("child-unpaid");
  });

  it("returns forbidden for another customer group", async () => {
    const { getCustomerRecurringScheduleGroupDetail } = await import(
      "./customerRecurringGroupDetailReadModel"
    );
    createSupabaseServerClientMock.mockResolvedValue(
      createClient({
        group: { ...groupRow(), customer_id: "cust-other" },
        series: [],
        bookings: [],
        requests: [],
      }),
    );

    const result = await getCustomerRecurringScheduleGroupDetail(customerUser, "group-1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("FORBIDDEN");
  });

  it("loads request history", async () => {
    const { getCustomerRecurringScheduleGroupDetail } = await import(
      "./customerRecurringGroupDetailReadModel"
    );
    createSupabaseServerClientMock.mockResolvedValue(
      createClient({
        group: groupRow(),
        series: [seriesRow("series-mon", 1)],
        bookings: [],
        requests: [
          {
            id: "req-1",
            series_id: null,
            group_id: "group-1",
            customer_id: "cust-1",
            scope: "group",
            target_weekday: null,
            request_type: "pause_group",
            status: "open",
            note: "Holiday",
            created_at: "2026-06-01T08:00:00.000Z",
            resolved_at: null,
            metadata: {},
          },
        ],
      }),
    );

    const result = await getCustomerRecurringScheduleGroupDetail(customerUser, "group-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.group.openRequestCount).toBe(1);
    expect(result.group.supportRequests.open[0]?.requestType).toBe("pause_group");
  });
});
