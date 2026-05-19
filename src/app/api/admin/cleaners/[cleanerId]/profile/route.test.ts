import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/types";

const requireApiUserMock = vi.fn();
const updateCleanerProfileMock = vi.fn();

vi.mock("@/features/dashboards/server/apiAuth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
  isApiAuthFailure: (user: unknown) =>
    typeof user === "object" && user !== null && "ok" in user && (user as { ok: boolean }).ok === false,
}));

vi.mock("@/features/cleaners/server/admin/updateCleanerProfile", () => ({
  updateCleanerProfile: (...args: unknown[]) => updateCleanerProfileMock(...args),
}));

const adminUser: CurrentUser = {
  profileId: "profile-admin",
  role: "admin",
  authUser: { id: "auth-admin" } as CurrentUser["authUser"],
};

const routeContext = { params: Promise.resolve({ cleanerId: "cleaner-1" }) };

describe("PATCH /api/admin/cleaners/[cleanerId]/profile", () => {
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

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({
          fullName: "Ada",
          serviceAreasInput: "",
          capabilities: ["regular-cleaning"],
        }),
      }),
      routeContext,
    );

    expect(response.status).toBe(403);
    expect(updateCleanerProfileMock).not.toHaveBeenCalled();
  });

  it("rejects lifecycle fields before updateCleanerProfile", async () => {
    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({
          fullName: "Ada",
          serviceAreasInput: "",
          capabilities: ["regular-cleaning"],
          suspended: true,
        }),
      }),
      routeContext,
    );

    expect(response.status).toBe(400);
    expect(updateCleanerProfileMock).not.toHaveBeenCalled();
  });

  it("rejects phone in body", async () => {
    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({
          fullName: "Ada",
          phone: "0792022648",
          serviceAreasInput: "",
          capabilities: ["regular-cleaning"],
        }),
      }),
      routeContext,
    );

    expect(response.status).toBe(400);
    expect(updateCleanerProfileMock).not.toHaveBeenCalled();
  });

  it("returns 200 on success", async () => {
    updateCleanerProfileMock.mockResolvedValue({
      ok: true,
      cleanerId: "cleaner-1",
      auditId: "audit-1",
      message: "Cleaner profile updated.",
    });

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({
          fullName: "Ada Cleaner",
          serviceAreasInput: "Sea Point",
          capabilities: ["regular-cleaning"],
        }),
      }),
      routeContext,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      cleanerId: "cleaner-1",
      auditId: "audit-1",
      message: "Cleaner profile updated.",
    });
    expect(updateCleanerProfileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cleanerId: "cleaner-1",
        adminProfileId: "profile-admin",
        fullName: "Ada Cleaner",
      }),
    );
  });
});
