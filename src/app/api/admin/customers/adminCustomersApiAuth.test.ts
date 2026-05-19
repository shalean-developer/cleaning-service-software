import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/types";

const requireApiUserMock = vi.fn();
const listAdminCustomersMock = vi.fn();
const getAdminCustomerDetailMock = vi.fn();
const createCustomerMock = vi.fn();

vi.mock("@/features/dashboards/server/apiAuth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
  isApiAuthFailure: (user: unknown) =>
    typeof user === "object" && user !== null && "ok" in user && (user as { ok: boolean }).ok === false,
}));

vi.mock("@/features/customers/server/admin/adminCustomersReadModel", () => ({
  listAdminCustomers: (...args: unknown[]) => listAdminCustomersMock(...args),
  getAdminCustomerDetail: (...args: unknown[]) => getAdminCustomerDetailMock(...args),
}));

vi.mock("@/features/customers/server/admin/createCustomer", () => ({
  createCustomer: (...args: unknown[]) => createCustomerMock(...args),
}));

const adminUser: CurrentUser = {
  profileId: "profile-admin",
  role: "admin",
  authUser: { id: "auth-admin" } as CurrentUser["authUser"],
};

const sampleCustomerId = "a196947b-fc37-465d-953b-d529e9eb6ea5";

function authFailure(status: number, error: string, message: string) {
  return { ok: false as const, status, error, message };
}

describe("admin customers API auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listAdminCustomersMock.mockResolvedValue({
      ok: true,
      items: [],
      page: 1,
      limit: 50,
      matchTotal: 0,
      returnedCount: 0,
      capped: false,
    });
    getAdminCustomerDetailMock.mockResolvedValue({
      ok: true,
      detail: { customerId: sampleCustomerId },
    });
    createCustomerMock.mockResolvedValue({
      ok: true,
      idempotent: false,
      auditId: "audit-1",
      customer: {
        customerId: sampleCustomerId,
        profileId: "profile-customer",
        email: "new@example.com",
        fullName: "New Customer",
        companyName: "New Co",
        phone: null,
        notes: null,
        createdAuthUser: true,
        createdCustomer: true,
        warnings: [],
      },
    });
  });

  describe("GET /api/admin/customers", () => {
    it("returns 401 when logged out", async () => {
      requireApiUserMock.mockResolvedValue(
        authFailure(401, "UNAUTHORIZED", "Sign in required."),
      );
      const { GET } = await import("./route");
      const response = await GET(new Request("http://localhost/api/admin/customers"));
      expect(response.status).toBe(401);
      expect(listAdminCustomersMock).not.toHaveBeenCalled();
    });

    it("returns 403 for customer role", async () => {
      requireApiUserMock.mockResolvedValue(
        authFailure(403, "FORBIDDEN", "Insufficient role."),
      );
      const { GET } = await import("./route");
      const response = await GET(new Request("http://localhost/api/admin/customers"));
      expect(response.status).toBe(403);
      expect(listAdminCustomersMock).not.toHaveBeenCalled();
    });

    it("returns 403 for cleaner role", async () => {
      requireApiUserMock.mockResolvedValue(
        authFailure(403, "FORBIDDEN", "Insufficient role."),
      );
      const { GET } = await import("./route");
      const response = await GET(new Request("http://localhost/api/admin/customers"));
      expect(response.status).toBe(403);
    });

    it("returns 200 for admin role", async () => {
      requireApiUserMock.mockResolvedValue(adminUser);
      const { GET } = await import("./route");
      const response = await GET(new Request("http://localhost/api/admin/customers"));
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(listAdminCustomersMock).toHaveBeenCalledWith(adminUser, expect.any(Object));
    });
  });

  describe("POST /api/admin/customers", () => {
    const validBody = {
      email: "new@example.com",
      full_name: "New Customer",
      company_name: "New Co",
    };

    function postRequest(body: unknown = validBody) {
      return new Request("http://localhost/api/admin/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    it("returns 401 when logged out", async () => {
      requireApiUserMock.mockResolvedValue(
        authFailure(401, "UNAUTHORIZED", "Sign in required."),
      );
      const { POST } = await import("./route");
      const response = await POST(postRequest());
      expect(response.status).toBe(401);
      expect(createCustomerMock).not.toHaveBeenCalled();
    });

    it("returns 403 for customer role", async () => {
      requireApiUserMock.mockResolvedValue(
        authFailure(403, "FORBIDDEN", "Insufficient role."),
      );
      const { POST } = await import("./route");
      const response = await POST(postRequest());
      expect(response.status).toBe(403);
      expect(createCustomerMock).not.toHaveBeenCalled();
    });

    it("returns 403 for cleaner role", async () => {
      requireApiUserMock.mockResolvedValue(
        authFailure(403, "FORBIDDEN", "Insufficient role."),
      );
      const { POST } = await import("./route");
      const response = await POST(postRequest());
      expect(response.status).toBe(403);
    });

    it("returns 201 for admin role on create", async () => {
      requireApiUserMock.mockResolvedValue(adminUser);
      const { POST } = await import("./route");
      const response = await POST(postRequest());
      const body = await response.json();
      expect(response.status).toBe(201);
      expect(body.ok).toBe(true);
      expect(body.customer.customerId).toBe(sampleCustomerId);
      expect(createCustomerMock).toHaveBeenCalledWith(
        expect.objectContaining({
          adminProfileId: adminUser.profileId,
          email: "new@example.com",
          fullName: "New Customer",
        }),
      );
    });

    it("returns 200 when create is idempotent", async () => {
      createCustomerMock.mockResolvedValue({
        ok: true,
        idempotent: true,
        auditId: "audit-2",
        customer: {
          customerId: sampleCustomerId,
          profileId: "profile-customer",
          email: "existing@example.com",
          fullName: "Existing",
          companyName: "Existing Co",
          phone: null,
          notes: null,
          createdAuthUser: false,
          createdCustomer: false,
          warnings: ["Customer already exists"],
        },
      });
      requireApiUserMock.mockResolvedValue(adminUser);
      const { POST } = await import("./route");
      const response = await POST(
        postRequest({ email: "existing@example.com", full_name: "Existing" }),
      );
      expect(response.status).toBe(200);
    });

    it("returns 400 for invalid email", async () => {
      requireApiUserMock.mockResolvedValue(adminUser);
      const { POST } = await import("./route");
      const response = await POST(
        postRequest({ email: "not-an-email", full_name: "X" }),
      );
      expect(response.status).toBe(400);
      expect(createCustomerMock).not.toHaveBeenCalled();
    });

    it("returns 400 for invalid phone", async () => {
      createCustomerMock.mockResolvedValue({
        ok: false,
        code: "INVALID_PHONE",
        message: "Invalid phone",
      });
      requireApiUserMock.mockResolvedValue(adminUser);
      const { POST } = await import("./route");
      const response = await POST(
        postRequest({ ...validBody, phone: "123" }),
      );
      expect(response.status).toBe(400);
    });

    it("does not export PATCH or DELETE", async () => {
      const route = await import("./route");
      expect(route).not.toHaveProperty("PATCH");
      expect(route).not.toHaveProperty("DELETE");
    });
  });

  describe("GET /api/admin/customers/[customerId]", () => {
    it("returns 401 when logged out", async () => {
      requireApiUserMock.mockResolvedValue(
        authFailure(401, "UNAUTHORIZED", "Sign in required."),
      );
      const { GET } = await import("./[customerId]/route");
      const response = await GET(new Request("http://localhost"), {
        params: Promise.resolve({ customerId: sampleCustomerId }),
      });
      expect(response.status).toBe(401);
      expect(getAdminCustomerDetailMock).not.toHaveBeenCalled();
    });

    it("returns 403 for customer role", async () => {
      requireApiUserMock.mockResolvedValue(
        authFailure(403, "FORBIDDEN", "Insufficient role."),
      );
      const { GET } = await import("./[customerId]/route");
      const response = await GET(new Request("http://localhost"), {
        params: Promise.resolve({ customerId: sampleCustomerId }),
      });
      expect(response.status).toBe(403);
      expect(getAdminCustomerDetailMock).not.toHaveBeenCalled();
    });

    it("returns 403 for cleaner role", async () => {
      requireApiUserMock.mockResolvedValue(
        authFailure(403, "FORBIDDEN", "Insufficient role."),
      );
      const { GET } = await import("./[customerId]/route");
      const response = await GET(new Request("http://localhost"), {
        params: Promise.resolve({ customerId: sampleCustomerId }),
      });
      expect(response.status).toBe(403);
    });

    it("returns 200 for admin role", async () => {
      requireApiUserMock.mockResolvedValue(adminUser);
      const { GET } = await import("./[customerId]/route");
      const response = await GET(new Request("http://localhost"), {
        params: Promise.resolve({ customerId: sampleCustomerId }),
      });
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(getAdminCustomerDetailMock).toHaveBeenCalledWith(adminUser, sampleCustomerId);
    });
  });
});
