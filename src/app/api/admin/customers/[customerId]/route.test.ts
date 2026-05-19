import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/types";

const requireApiUserMock = vi.fn();
const getAdminCustomerDetailMock = vi.fn();
const updateCustomerMock = vi.fn();

vi.mock("@/features/dashboards/server/apiAuth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
  isApiAuthFailure: (user: unknown) =>
    typeof user === "object" && user !== null && "ok" in user && (user as { ok: boolean }).ok === false,
}));

vi.mock("@/features/customers/server/admin/adminCustomersReadModel", () => ({
  getAdminCustomerDetail: (...args: unknown[]) => getAdminCustomerDetailMock(...args),
}));

vi.mock("@/features/customers/server/admin/updateCustomer", () => ({
  updateCustomer: (...args: unknown[]) => updateCustomerMock(...args),
}));

const adminUser: CurrentUser = {
  profileId: "profile-admin",
  role: "admin",
  authUser: { id: "auth-admin" } as CurrentUser["authUser"],
};

describe("GET /api/admin/customers/[customerId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue(adminUser);
    getAdminCustomerDetailMock.mockResolvedValue({
      ok: true,
      detail: { customerId: "cust-1" },
    });
  });

  it("returns 400 for invalid customerId", async () => {
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ customerId: "not-a-uuid" }),
    });
    expect(response.status).toBe(400);
    expect(getAdminCustomerDetailMock).not.toHaveBeenCalled();
  });

  it("loads detail for a valid customerId", async () => {
    const customerId = "a196947b-fc37-465d-953b-d529e9eb6ea5";
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ customerId }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(getAdminCustomerDetailMock).toHaveBeenCalledWith(adminUser, customerId);
  });

  it("does not expose POST or DELETE", async () => {
    const routeModule = await import("./route");
    expect(typeof routeModule.GET).toBe("function");
    expect(typeof routeModule.PATCH).toBe("function");
    expect("POST" in routeModule).toBe(false);
    expect("DELETE" in routeModule).toBe(false);
  });
});

describe("PATCH /api/admin/customers/[customerId]", () => {
  const customerId = "a196947b-fc37-465d-953b-d529e9eb6ea5";

  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue(adminUser);
    updateCustomerMock.mockResolvedValue({
      ok: true,
      auditId: "audit-1",
      customer: {
        customerId,
        profileId: "profile-customer",
        companyName: "Updated Co",
        phone: null,
        notes: null,
        customerUpdatedAt: "2026-05-20T12:00:00.000Z",
        warnings: [],
      },
    });
  });

  function patchRequest(body: unknown) {
    return new Request("http://localhost", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns 401 when logged out", async () => {
    requireApiUserMock.mockResolvedValue({
      ok: false,
      status: 401,
      error: "UNAUTHORIZED",
      message: "Sign in required.",
    });
    const { PATCH } = await import("./route");
    const response = await PATCH(patchRequest({ company_name: "X" }), {
      params: Promise.resolve({ customerId }),
    });
    expect(response.status).toBe(401);
    expect(updateCustomerMock).not.toHaveBeenCalled();
  });

  it("returns 403 for customer role", async () => {
    requireApiUserMock.mockResolvedValue({
      ok: false,
      status: 403,
      error: "FORBIDDEN",
      message: "Insufficient role.",
    });
    const { PATCH } = await import("./route");
    const response = await PATCH(patchRequest({ company_name: "X" }), {
      params: Promise.resolve({ customerId }),
    });
    expect(response.status).toBe(403);
  });

  it("returns 200 for admin", async () => {
    const { PATCH } = await import("./route");
    const response = await PATCH(patchRequest({ company_name: "Updated Co" }), {
      params: Promise.resolve({ customerId }),
    });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.customer.companyName).toBe("Updated Co");
  });

  it("returns 400 for invalid UUID", async () => {
    const { PATCH } = await import("./route");
    const response = await PATCH(patchRequest({ company_name: "X" }), {
      params: Promise.resolve({ customerId: "not-a-uuid" }),
    });
    expect(response.status).toBe(400);
    expect(updateCustomerMock).not.toHaveBeenCalled();
  });

  it("returns 400 for unknown field", async () => {
    const { PATCH } = await import("./route");
    const response = await PATCH(patchRequest({ company_name: "X", email: "a@b.com" }), {
      params: Promise.resolve({ customerId }),
    });
    expect(response.status).toBe(400);
    expect(updateCustomerMock).not.toHaveBeenCalled();
  });

  it("does not export DELETE", async () => {
    const routeModule = await import("./route");
    expect("DELETE" in routeModule).toBe(false);
  });
});
