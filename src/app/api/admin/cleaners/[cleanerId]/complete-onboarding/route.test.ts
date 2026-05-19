import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/types";

const requireApiUserMock = vi.fn();
const completeOnboardingMock = vi.fn();

vi.mock("@/features/dashboards/server/apiAuth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
  isApiAuthFailure: (user: unknown) =>
    typeof user === "object" && user !== null && "ok" in user && (user as { ok: boolean }).ok === false,
}));

vi.mock("@/features/cleaners/server/lifecycle/completeCleanerOnboarding", () => ({
  completeCleanerOnboarding: (...args: unknown[]) => completeOnboardingMock(...args),
}));

const adminUser: CurrentUser = {
  profileId: "profile-admin",
  role: "admin",
  authUser: { id: "auth-admin" } as CurrentUser["authUser"],
};

const routeContext = { params: Promise.resolve({ cleanerId: "cleaner-1" }) };

describe("POST /api/admin/cleaners/[cleanerId]/complete-onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue(adminUser);
  });

  it("rejects non-admin callers", async () => {
    requireApiUserMock.mockResolvedValue({
      ok: false,
      status: 403,
      error: "FORBIDDEN",
      message: "Insufficient role.",
    });

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost", { method: "POST" }), routeContext);
    expect(response.status).toBe(403);
    expect(completeOnboardingMock).not.toHaveBeenCalled();
  });

  it("calls completeCleanerOnboarding for admin", async () => {
    completeOnboardingMock.mockResolvedValue({
      ok: true,
      outcome: "success",
      cleanerId: "cleaner-1",
      auditId: "audit-1",
      message: "Onboarding completed. Cleaner is now active.",
      affectedCounts: {
        openOffersCancelled: 0,
        activeBookingsFound: 0,
        pendingEarningsFound: 0,
      },
      beforeState: {},
      afterState: {},
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost", { method: "POST", body: "{}" }),
      routeContext,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(completeOnboardingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cleanerId: "cleaner-1",
        adminProfileId: "profile-admin",
      }),
    );
  });
});
