import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/types";

const requireApiUserMock = vi.fn();
const dispatchMock = vi.fn();

vi.mock("@/features/dashboards/server/apiAuth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
  isApiAuthFailure: (user: unknown) =>
    typeof user === "object" && user !== null && "ok" in user && (user as { ok: boolean }).ok === false,
}));

vi.mock("@/features/assignments/server/adminManualDispatchOffer", () => ({
  runAdminManualDispatchOffer: (...args: unknown[]) => dispatchMock(...args),
}));

const adminUser: CurrentUser = {
  profileId: "profile-admin",
  role: "admin",
  authUser: { id: "auth-admin" } as CurrentUser["authUser"],
};

describe("POST /api/admin/bookings/[bookingId]/dispatch-offer", () => {
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
        body: JSON.stringify({
          cleanerId: "cleaner-1",
          reason: "valid reason here",
        }),
      }),
      { params: Promise.resolve({ bookingId: "booking-1" }) },
    );
    expect(response.status).toBe(401);
  });

  it("returns dispatch result for admin", async () => {
    dispatchMock.mockResolvedValue({
      ok: true,
      status: "offered",
      bookingId: "booking-1",
      bookingStatus: "pending_assignment",
      cleanerId: "cleaner-1",
      offerId: "offer-1",
      idempotent: false,
      message: "Offer sent to cleaner.",
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cleanerId: "cleaner-1",
          reason: "Selected cleaner declined",
          acknowledgeMaxAttempts: true,
        }),
      }),
      { params: Promise.resolve({ bookingId: "booking-1" }) },
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.status).toBe("offered");
    expect(dispatchMock).toHaveBeenCalledWith(
      adminUser,
      "booking-1",
      expect.objectContaining({
        cleanerId: "cleaner-1",
        reason: "Selected cleaner declined",
        acknowledgeMaxAttempts: true,
      }),
    );
  });
});
