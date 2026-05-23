import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/types";
import type { BookingCleanerRow } from "@/lib/database/types";

const isTeamOffersEnabledMock = vi.fn(() => true);
const createSupabaseServerClientMock = vi.fn();
const resolveActorScopeMock = vi.fn();
const loadRosterRowForCleanerMock = vi.fn();

vi.mock("@/features/assignments/server/teamOffersConfig", () => ({
  isTeamOffersEnabled: () => isTeamOffersEnabledMock(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => createSupabaseServerClientMock(),
}));

vi.mock("@/lib/auth/resolveActorScope", () => ({
  resolveActorScope: (...args: unknown[]) => resolveActorScopeMock(...args),
}));

vi.mock("@/features/earnings/server/teamEarningsConfig", () => ({
  isTeamEarningsEnabled: () => false,
}));

vi.mock("@/features/dashboards/server/cleanerTeamJobVisibility", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/dashboards/server/cleanerTeamJobVisibility")
  >();
  return {
    ...actual,
    loadRosterRowForCleaner: (...args: unknown[]) => loadRosterRowForCleanerMock(...args),
  };
});

const cleanerUser: CurrentUser = {
  profileId: "profile-support",
  role: "cleaner",
  authUser: { id: "auth-support" } as CurrentUser["authUser"],
};

const supportRoster: BookingCleanerRow = {
  id: "roster-support",
  booking_id: "booking-1",
  cleaner_id: "cleaner-support",
  role: "support",
  status: "accepted",
  assigned_by_profile_id: null,
  support_completed_at: null,
  support_note: null,
  created_at: "2026-05-23T10:00:00.000Z",
  updated_at: "2026-05-23T10:00:00.000Z",
};

function mockClient(bookingStatus: string) {
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn(() => ({
    eq: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: updateEq,
      })),
    })),
  }));

  return {
    from: vi.fn((table: string) => {
      if (table === "bookings") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: "booking-1",
              status: bookingStatus,
              cleaner_id: "cleaner-lead",
            },
            error: null,
          }),
        };
      }
      if (table === "booking_cleaners") {
        return { update };
      }
      return {};
    }),
    _updateEq: updateEq,
  };
}

describe("markSupportParticipationCompleted (NF-7F)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isTeamOffersEnabledMock.mockReturnValue(true);
    resolveActorScopeMock.mockResolvedValue({ actingCleanerId: "cleaner-support" });
    loadRosterRowForCleanerMock.mockResolvedValue(supportRoster);
  });

  it("rejects when team offers disabled", async () => {
    isTeamOffersEnabledMock.mockReturnValue(false);
    const { markSupportParticipationCompleted } = await import("./supportParticipationActions");
    const result = await markSupportParticipationCompleted(cleanerUser, "booking-1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("FEATURE_DISABLED");
  });

  it("updates roster to completed without booking lifecycle command", async () => {
    const client = mockClient("in_progress");
    createSupabaseServerClientMock.mockResolvedValue(client);

    const { markSupportParticipationCompleted } = await import("./supportParticipationActions");
    const result = await markSupportParticipationCompleted(
      cleanerUser,
      "booking-1",
      "Helped on site",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe("completed");
      expect(result.idempotent).toBe(false);
    }
    expect(client.from).toHaveBeenCalledWith("booking_cleaners");
    expect(client._updateEq).toHaveBeenCalled();
  });

  it("is idempotent when roster already completed", async () => {
    loadRosterRowForCleanerMock.mockResolvedValue({
      ...supportRoster,
      status: "completed",
      support_completed_at: "2026-05-25T10:00:00.000Z",
    });
    createSupabaseServerClientMock.mockResolvedValue(mockClient("completed"));

    const { markSupportParticipationCompleted } = await import("./supportParticipationActions");
    const result = await markSupportParticipationCompleted(cleanerUser, "booking-1");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.idempotent).toBe(true);
  });

  it("rejects non-support roster", async () => {
    loadRosterRowForCleanerMock.mockResolvedValue(null);
    createSupabaseServerClientMock.mockResolvedValue(mockClient("in_progress"));

    const { markSupportParticipationCompleted } = await import("./supportParticipationActions");
    const result = await markSupportParticipationCompleted(cleanerUser, "booking-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("FORBIDDEN");
  });

  it("rejects when booking not in progress or completed", async () => {
    createSupabaseServerClientMock.mockResolvedValue(mockClient("assigned"));

    const { markSupportParticipationCompleted } = await import("./supportParticipationActions");
    const result = await markSupportParticipationCompleted(cleanerUser, "booking-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_STATE");
  });
});
