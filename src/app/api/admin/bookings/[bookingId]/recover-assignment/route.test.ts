import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/types";

const requireApiUserMock = vi.fn();
const recoveryMock = vi.fn();

vi.mock("@/features/dashboards/server/apiAuth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
  isApiAuthFailure: (user: unknown) =>
    typeof user === "object" && user !== null && "ok" in user && (user as { ok: boolean }).ok === false,
}));

vi.mock("@/features/assignments/server/adminAssignmentRecovery", () => ({
  runAdminSingleBookingAssignmentRecovery: (...args: unknown[]) => recoveryMock(...args),
}));

const adminUser: CurrentUser = {
  profileId: "profile-admin",
  role: "admin",
  authUser: { id: "auth-admin" } as CurrentUser["authUser"],
};

describe("POST /api/admin/bookings/[bookingId]/recover-assignment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue(adminUser);
  });

  it("rejects unauthenticated requests", async () => {
    requireApiUserMock.mockResolvedValue({
      ok: false,
      status: 401,
      error: "UNAUTHORIZED",
      message: "Sign in required.",
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ reason: "valid reason here" }),
      }),
      { params: Promise.resolve({ bookingId: "booking-1" }) },
    );
    expect(response.status).toBe(401);
  });

  it("returns recovery result for admin", async () => {
    recoveryMock.mockResolvedValue({
      ok: true,
      status: "recovered",
      bookingId: "booking-1",
      bookingStatus: "pending_assignment",
      outcome: "offered",
      offerId: "offer-1",
      cleanerId: "cleaner-1",
      idempotent: false,
      message: "Assignment recovery succeeded.",
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Dispatch did not start" }),
      }),
      { params: Promise.resolve({ bookingId: "booking-1" }) },
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.status).toBe("recovered");
    expect(recoveryMock).toHaveBeenCalledWith(
      adminUser,
      "booking-1",
      expect.objectContaining({ reason: "Dispatch did not start" }),
    );
  });
});
