import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/types";

const requireApiUserMock = vi.fn();
const replaceMock = vi.fn();

vi.mock("@/features/dashboards/server/apiAuth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
  isApiAuthFailure: (user: unknown) =>
    typeof user === "object" && user !== null && "ok" in user && (user as { ok: boolean }).ok === false,
}));

vi.mock("@/features/assignments/server/adminReplaceOpenOffer", () => ({
  runAdminReplaceOpenOffer: (...args: unknown[]) => replaceMock(...args),
}));

const adminUser: CurrentUser = {
  profileId: "profile-admin",
  role: "admin",
  authUser: { id: "auth-admin" } as CurrentUser["authUser"],
};

describe("POST /api/admin/bookings/[bookingId]/replace-open-offer", () => {
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
          targetCleanerId: "cleaner-b",
          reason: "valid reason here",
        }),
      }),
      { params: Promise.resolve({ bookingId: "booking-1" }) },
    );
    expect(response.status).toBe(401);
  });

  it("returns replace result for admin", async () => {
    replaceMock.mockResolvedValue({
      ok: true,
      status: "replaced",
      bookingId: "booking-1",
      bookingStatus: "pending_assignment",
      cancelledOfferId: "offer-a",
      cancelledCleanerId: "cleaner-a",
      targetCleanerId: "cleaner-b",
      offerId: "offer-b",
      idempotent: false,
      message: "Open offer cancelled and new offer sent.",
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetCleanerId: "cleaner-b",
          reason: "Cleaner A not responding",
        }),
      }),
      { params: Promise.resolve({ bookingId: "booking-1" }) },
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.status).toBe("replaced");
    expect(replaceMock).toHaveBeenCalledWith(
      adminUser,
      "booking-1",
      expect.objectContaining({
        targetCleanerId: "cleaner-b",
        reason: "Cleaner A not responding",
      }),
    );
  });
});
