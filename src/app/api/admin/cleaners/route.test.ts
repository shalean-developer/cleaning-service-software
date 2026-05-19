import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/types";

const requireApiUserMock = vi.fn();
const createCleanerMock = vi.fn();

vi.mock("@/features/dashboards/server/apiAuth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
  isApiAuthFailure: (user: unknown) =>
    typeof user === "object" && user !== null && "ok" in user && (user as { ok: boolean }).ok === false,
}));

vi.mock("@/features/cleaners/server/admin/createCleaner", () => ({
  createCleaner: (...args: unknown[]) => createCleanerMock(...args),
}));

const adminUser: CurrentUser = {
  profileId: "profile-admin",
  role: "admin",
  authUser: { id: "auth-admin" } as CurrentUser["authUser"],
};

describe("POST /api/admin/cleaners", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue(adminUser);
  });

  it("rejects non-admin callers", async () => {
    requireApiUserMock.mockResolvedValue({
      ok: false,
      status: 403,
      error: "FORBIDDEN",
      message: "Admins only.",
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          fullName: "Ada",
          phone: "0792022648",
          password: "secure-pass-1",
          confirmPassword: "secure-pass-1",
          capabilities: ["regular-cleaning"],
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(createCleanerMock).not.toHaveBeenCalled();
  });

  it("calls createCleaner with validated payload fields only", async () => {
    createCleanerMock.mockResolvedValue({
      ok: true,
      cleanerId: "cleaner-1",
      auditId: "audit-1",
      message: "Cleaner account created.",
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          fullName: "Ada Cleaner",
          phone: "0792022648",
          password: "secure-pass-1",
          confirmPassword: "secure-pass-1",
          serviceAreasInput: "Sea Point",
          capabilities: ["regular-cleaning"],
          active: true,
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(createCleanerMock).not.toHaveBeenCalled();
  });

  it("returns cleanerId on success", async () => {
    createCleanerMock.mockResolvedValue({
      ok: true,
      cleanerId: "cleaner-1",
      auditId: "audit-1",
      message: "Cleaner account created.",
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          fullName: "Ada Cleaner",
          phone: "0792022648",
          password: "secure-pass-1",
          confirmPassword: "secure-pass-1",
          serviceAreasInput: "",
          capabilities: ["regular-cleaning"],
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({
      ok: true,
      cleanerId: "cleaner-1",
      auditId: "audit-1",
      message: "Cleaner account created.",
    });
    expect(createCleanerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        adminProfileId: "profile-admin",
        fullName: "Ada Cleaner",
        phone: "0792022648",
      }),
    );
    const callArg = createCleanerMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(callArg).not.toHaveProperty("active");
  });

  it("returns 409 when createCleaner reports duplicate phone", async () => {
    createCleanerMock.mockResolvedValue({
      ok: false,
      code: "PHONE_ALREADY_REGISTERED",
      message: "A cleaner with this phone number already exists.",
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          fullName: "Ada Cleaner",
          phone: "0792022648",
          password: "secure-pass-1",
          confirmPassword: "secure-pass-1",
          serviceAreasInput: "",
          capabilities: ["regular-cleaning"],
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      ok: false,
      error: "PHONE_ALREADY_REGISTERED",
    });
  });
});
