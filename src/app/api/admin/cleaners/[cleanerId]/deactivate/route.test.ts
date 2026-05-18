import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/types";

const requireApiUserMock = vi.fn();
const deactivateMock = vi.fn();

vi.mock("@/features/dashboards/server/apiAuth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
  isApiAuthFailure: (user: unknown) =>
    typeof user === "object" && user !== null && "ok" in user && (user as { ok: boolean }).ok === false,
}));

vi.mock("@/features/cleaners/server/lifecycle/deactivateCleaner", () => ({
  deactivateCleaner: (...args: unknown[]) => deactivateMock(...args),
}));

const adminUser: CurrentUser = {
  profileId: "profile-admin",
  role: "admin",
  authUser: { id: "auth-admin" } as CurrentUser["authUser"],
};

describe("POST /api/admin/cleaners/[cleanerId]/deactivate", () => {
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
        body: JSON.stringify({ reason: "Policy violation" }),
      }),
      { params: Promise.resolve({ cleanerId: "cleaner-1" }) },
    );
    expect(response.status).toBe(401);
  });

  it("calls deactivateCleaner for admin", async () => {
    deactivateMock.mockResolvedValue({
      ok: true,
      outcome: "success",
      cleanerId: "cleaner-1",
      auditId: "audit-1",
      message: "Cleaner deactivated.",
      affectedCounts: {
        openOffersCancelled: 1,
        activeBookingsFound: 0,
        pendingEarningsFound: 0,
      },
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ reason: "Policy violation" }),
      }),
      { params: Promise.resolve({ cleanerId: "cleaner-1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(deactivateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cleanerId: "cleaner-1",
        adminProfileId: "profile-admin",
        reason: "Policy violation",
      }),
    );
  });
});
