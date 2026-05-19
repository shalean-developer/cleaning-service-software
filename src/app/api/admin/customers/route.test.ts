import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/types";

const requireApiUserMock = vi.fn();
const listAdminCustomersMock = vi.fn();

vi.mock("@/features/dashboards/server/apiAuth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
  isApiAuthFailure: (user: unknown) =>
    typeof user === "object" && user !== null && "ok" in user && (user as { ok: boolean }).ok === false,
}));

vi.mock("@/features/customers/server/admin/adminCustomersReadModel", () => ({
  listAdminCustomers: (...args: unknown[]) => listAdminCustomersMock(...args),
}));

const adminUser: CurrentUser = {
  profileId: "profile-admin",
  role: "admin",
  authUser: { id: "auth-admin" } as CurrentUser["authUser"],
};

describe("GET /api/admin/customers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue(adminUser);
    listAdminCustomersMock.mockResolvedValue({
      ok: true,
      items: [],
      page: 1,
      limit: 50,
      matchTotal: 0,
      returnedCount: 0,
      capped: false,
    });
  });

  it("returns 403 for non-admin auth failure", async () => {
    requireApiUserMock.mockResolvedValue({
      ok: false,
      status: 403,
      error: "FORBIDDEN",
      message: "Admins only.",
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/admin/customers"));
    expect(response.status).toBe(403);
    expect(listAdminCustomersMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid query params", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/admin/customers?page=0&limit=500"),
    );
    expect(response.status).toBe(400);
    expect(listAdminCustomersMock).not.toHaveBeenCalled();
  });

  it("forwards pagination, search, and filters to the read model", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request(
        "http://localhost/api/admin/customers?page=2&limit=25&q=acme&bookings=has_bookings&health=healthy&activity=created_last_30_days",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(listAdminCustomersMock).toHaveBeenCalledWith(adminUser, {
      page: 2,
      limit: 25,
      q: "acme",
      bookings: "has_bookings",
      health: "healthy",
      activity: "created_last_30_days",
    });
  });

  it("returns 400 for invalid filter params", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/admin/customers?bookings=invalid"),
    );
    expect(response.status).toBe(400);
    expect(listAdminCustomersMock).not.toHaveBeenCalled();
  });

  it("does not expose PATCH or DELETE on list route", async () => {
    const routeModule = await import("./route");
    expect(typeof routeModule.GET).toBe("function");
    expect(typeof routeModule.POST).toBe("function");
    expect("PATCH" in routeModule).toBe(false);
    expect("DELETE" in routeModule).toBe(false);
  });
});
