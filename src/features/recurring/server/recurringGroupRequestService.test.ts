import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/types";

const createSupabaseServerClientMock = vi.fn();
const resolveActorScopeMock = vi.fn();
const insertScopedRecurringRequestMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => createSupabaseServerClientMock(),
}));

vi.mock("@/lib/auth/resolveActorScope", () => ({
  resolveActorScope: (...args: unknown[]) => resolveActorScopeMock(...args),
}));

vi.mock("./recurringSeriesRequestsService", () => ({
  insertScopedRecurringRequest: (...args: unknown[]) =>
    insertScopedRecurringRequestMock(...args),
}));

const customerUser: CurrentUser = {
  profileId: "profile-cust",
  role: "customer",
  authUser: { id: "auth-cust" } as CurrentUser["authUser"],
};

function createClient(input: {
  group?: Record<string, unknown> | null;
  series?: Record<string, unknown>[];
}) {
  return {
    from(table: string) {
      if (table === "recurring_schedule_groups") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: input.group ?? null, error: null }),
            }),
          }),
        };
      }
      if (table === "booking_series") {
        return {
          select: () => ({
            eq: async () => ({ data: input.series ?? [], error: null }),
          }),
        };
      }
      throw new Error(`unexpected ${table}`);
    },
  };
}

describe("customerRequestRecurringGroupChange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveActorScopeMock.mockResolvedValue({ actingCustomerId: "cust-1" });
    insertScopedRecurringRequestMock.mockResolvedValue({ ok: true, requestId: "req-1" });
  });

  it("creates group pause request without mutating series", async () => {
    const { customerRequestRecurringGroupChange } = await import("./recurringGroupRequestService");
    createSupabaseServerClientMock.mockResolvedValue(
      createClient({
        group: {
          id: "group-1",
          customer_id: "cust-1",
          anchor_booking_id: "anchor-1",
          selected_days: [1, 3],
        },
        series: [{ id: "series-mon", weekday: 1, group_id: "group-1" }],
      }),
    );

    const result = await customerRequestRecurringGroupChange(customerUser, "group-1", {
      requestType: "pause_group",
    });
    expect(result.ok).toBe(true);
    expect(insertScopedRecurringRequestMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        scope: "group",
        groupId: "group-1",
        requestType: "pause_group",
        seriesId: null,
      }),
    );
  });

  it("validates weekday series belongs to group", async () => {
    const { customerRequestRecurringGroupChange } = await import("./recurringGroupRequestService");
    createSupabaseServerClientMock.mockResolvedValue(
      createClient({
        group: {
          id: "group-1",
          customer_id: "cust-1",
          anchor_booking_id: "anchor-1",
          selected_days: [1, 3],
        },
        series: [{ id: "series-mon", weekday: 1, group_id: "group-1" }],
      }),
    );

    const bad = await customerRequestRecurringGroupChange(customerUser, "group-1", {
      requestType: "pause_weekday",
      targetSeriesId: "series-unknown",
    });
    expect(bad.ok).toBe(false);
  });

  it("rejects another customer group", async () => {
    const { customerRequestRecurringGroupChange } = await import("./recurringGroupRequestService");
    createSupabaseServerClientMock.mockResolvedValue(
      createClient({
        group: {
          id: "group-1",
          customer_id: "cust-other",
          anchor_booking_id: "anchor-1",
          selected_days: [1],
        },
        series: [],
      }),
    );

    const result = await customerRequestRecurringGroupChange(customerUser, "group-1", {
      requestType: "cancel_group",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("FORBIDDEN");
  });
});
