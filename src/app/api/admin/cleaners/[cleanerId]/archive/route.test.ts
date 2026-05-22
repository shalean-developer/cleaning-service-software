import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/types";

const requireApiUserMock = vi.fn();
const archiveMock = vi.fn();

vi.mock("@/features/dashboards/server/apiAuth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
  isApiAuthFailure: (user: unknown) =>
    typeof user === "object" && user !== null && "ok" in user && (user as { ok: boolean }).ok === false,
}));

vi.mock("@/features/admin/server/entityArchive/archiveCleanerAdminCommand", () => ({
  archiveCleanerAdminCommand: (...args: unknown[]) => archiveMock(...args),
}));

const adminUser: CurrentUser = {
  profileId: "profile-admin",
  role: "admin",
  authUser: { id: "auth-admin" } as CurrentUser["authUser"],
};

describe("POST /api/admin/cleaners/[cleanerId]/archive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue(adminUser);
  });

  it("requires confirmation phrase", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ reason: "Left platform" }),
      }),
      { params: Promise.resolve({ cleanerId: "cleaner-1" }) },
    );

    expect(response.status).toBe(400);
    expect(archiveMock).not.toHaveBeenCalled();
  });

  it("calls archiveCleanerAdminCommand for admin", async () => {
    archiveMock.mockResolvedValue({
      ok: true,
      outcome: "success",
      cleanerId: "cleaner-1",
      auditId: "audit-1",
      message: "Cleaner archived.",
      affectedCounts: {
        openOffersCancelled: 0,
        activeBookingsFound: 0,
        pendingEarningsFound: 2,
      },
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          reason: "Left platform",
          confirmPhrase: "DELETE CLEANER",
        }),
      }),
      { params: Promise.resolve({ cleanerId: "cleaner-1" }) },
    );

    expect(response.status).toBe(200);
    expect(archiveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cleanerId: "cleaner-1",
        reason: "Left platform",
      }),
    );
  });
});
