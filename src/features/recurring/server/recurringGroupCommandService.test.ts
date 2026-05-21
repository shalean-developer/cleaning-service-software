import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/types";
import type { RecurringScheduleGroupRow } from "@/lib/database/types";

const createSupabaseServerClientMock = vi.fn();
const findScheduleGroupByIdMock = vi.fn();
const pauseRecurringScheduleGroupMock = vi.fn();
const resumeRecurringScheduleGroupMock = vi.fn();
const cancelRecurringScheduleGroupMock = vi.fn();
const generateRecurringOccurrencesForSeriesMock = vi.fn();
const recordRecurringSeriesAuditMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => createSupabaseServerClientMock(),
}));

vi.mock("../recurringScheduleGroupRepository", () => ({
  findScheduleGroupById: (...args: unknown[]) => findScheduleGroupByIdMock(...args),
}));

vi.mock("../scheduleGroupActions", () => ({
  pauseRecurringScheduleGroup: (...args: unknown[]) => pauseRecurringScheduleGroupMock(...args),
  resumeRecurringScheduleGroup: (...args: unknown[]) => resumeRecurringScheduleGroupMock(...args),
  cancelRecurringScheduleGroup: (...args: unknown[]) => cancelRecurringScheduleGroupMock(...args),
}));

vi.mock("../generateRecurringOccurrences", () => ({
  generateRecurringOccurrencesForSeries: (...args: unknown[]) =>
    generateRecurringOccurrencesForSeriesMock(...args),
}));

vi.mock("./recordRecurringSeriesAudit", () => ({
  recordRecurringSeriesAudit: (...args: unknown[]) => recordRecurringSeriesAuditMock(...args),
}));

vi.mock("@/features/bookings/server/commands/supabaseBookingCommandBackend", () => ({
  SupabaseBookingCommandBackend: vi.fn(),
}));

const adminUser: CurrentUser = {
  profileId: "profile-admin",
  role: "admin",
  authUser: { id: "auth-admin" } as CurrentUser["authUser"],
};

function group(overrides: Partial<RecurringScheduleGroupRow> = {}): RecurringScheduleGroupRow {
  return {
    id: "group-1",
    customer_id: "cust-1",
    service_slug: "standard-clean",
    status: overrides.status ?? "active",
    frequency: "weekly",
    timezone: "Africa/Johannesburg",
    label: null,
    selected_days: [1, 3],
    anchor_booking_id: "anchor-1",
    created_at: "2026-05-01T08:00:00.000Z",
    updated_at: "2026-05-01T08:00:00.000Z",
    ...overrides,
  };
}

function mockClient(pausedSeries: { id: string }[] = []) {
  return {
    from: (table: string) => {
      if (table === "booking_series") {
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({ data: pausedSeries, error: null }),
            }),
          }),
        };
      }
      throw new Error(`unexpected ${table}`);
    },
  };
}

describe("recurringGroupCommandService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSupabaseServerClientMock.mockResolvedValue(mockClient());
    findScheduleGroupByIdMock.mockResolvedValue(group());
    pauseRecurringScheduleGroupMock.mockResolvedValue(undefined);
    resumeRecurringScheduleGroupMock.mockResolvedValue(undefined);
    cancelRecurringScheduleGroupMock.mockResolvedValue({ cancelledBookings: 2 });
    generateRecurringOccurrencesForSeriesMock.mockResolvedValue(undefined);
    recordRecurringSeriesAuditMock.mockResolvedValue(undefined);
  });

  it("pause group pauses active group and writes audit", async () => {
    const { adminPauseRecurringScheduleGroup } = await import("./recurringGroupCommandService");
    const result = await adminPauseRecurringScheduleGroup(adminUser, "group-1");
    expect(result.ok).toBe(true);
    expect(pauseRecurringScheduleGroupMock).toHaveBeenCalled();
    expect(recordRecurringSeriesAuditMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "RECURRING_SCHEDULE_GROUP_PAUSE" }),
    );
  });

  it("pause is idempotent when group already paused", async () => {
    findScheduleGroupByIdMock.mockResolvedValue(group({ status: "paused" }));
    const { adminPauseRecurringScheduleGroup } = await import("./recurringGroupCommandService");
    const result = await adminPauseRecurringScheduleGroup(adminUser, "group-1");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.idempotent).toBe(true);
    expect(pauseRecurringScheduleGroupMock).not.toHaveBeenCalled();
  });

  it("resume group resumes paused series and regenerates horizon", async () => {
    findScheduleGroupByIdMock.mockResolvedValue(group({ status: "paused" }));
    createSupabaseServerClientMock.mockResolvedValue(
      mockClient([{ id: "series-a" }, { id: "series-b" }]),
    );
    const { adminResumeRecurringScheduleGroup } = await import("./recurringGroupCommandService");
    const result = await adminResumeRecurringScheduleGroup(adminUser, "group-1");
    expect(result.ok).toBe(true);
    expect(resumeRecurringScheduleGroupMock).toHaveBeenCalled();
    expect(generateRecurringOccurrencesForSeriesMock).toHaveBeenCalledTimes(2);
  });

  it("cancel group cancels and preserves idempotency when already cancelled", async () => {
    const { adminCancelRecurringScheduleGroup } = await import("./recurringGroupCommandService");
    const first = await adminCancelRecurringScheduleGroup(adminUser, "group-1");
    expect(first.ok).toBe(true);
    expect(cancelRecurringScheduleGroupMock).toHaveBeenCalled();

    findScheduleGroupByIdMock.mockResolvedValue(group({ status: "cancelled" }));
    const second = await adminCancelRecurringScheduleGroup(adminUser, "group-1");
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.idempotent).toBe(true);
  });
});
