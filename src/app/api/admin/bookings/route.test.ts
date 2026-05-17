import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/types";

const requireApiUserMock = vi.fn();
const listAdminBookingsMock = vi.fn();

vi.mock("@/features/dashboards/server/apiAuth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
  isApiAuthFailure: (user: unknown) =>
    typeof user === "object" && user !== null && "ok" in user && (user as { ok: boolean }).ok === false,
}));

vi.mock("@/features/dashboards/server/adminOperationsReadModel", () => ({
  listAdminBookings: (...args: unknown[]) => listAdminBookingsMock(...args),
}));

const adminUser: CurrentUser = {
  profileId: "profile-admin",
  role: "admin",
  authUser: { id: "auth-admin" } as CurrentUser["authUser"],
};

describe("GET /api/admin/bookings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue(adminUser);
    listAdminBookingsMock.mockResolvedValue({
      ok: true,
      bookings: [],
      matchTotal: 0,
      returnedCount: 0,
      limit: 200,
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
    const response = await GET(new Request("http://localhost/api/admin/bookings"));
    expect(response.status).toBe(403);
    expect(listAdminBookingsMock).not.toHaveBeenCalled();
  });

  it("forwards max_attempts filter to the read model", async () => {
    const { GET } = await import("./route");
    await GET(new Request("http://localhost/api/admin/bookings?filter=max_attempts"));
    expect(listAdminBookingsMock).toHaveBeenCalledWith(adminUser, {
      filter: "max_attempts",
      search: undefined,
      scheduledFrom: undefined,
      scheduledTo: undefined,
    });
  });

  it("forwards recovery_needed filter to the read model", async () => {
    const { GET } = await import("./route");
    await GET(new Request("http://localhost/api/admin/bookings?filter=recovery_needed"));
    expect(listAdminBookingsMock).toHaveBeenCalledWith(adminUser, {
      filter: "recovery_needed",
      search: undefined,
      scheduledFrom: undefined,
      scheduledTo: undefined,
    });
  });

  it("forwards dispatch_not_started filter to the read model", async () => {
    const { GET } = await import("./route");
    await GET(new Request("http://localhost/api/admin/bookings?filter=dispatch_not_started"));
    expect(listAdminBookingsMock).toHaveBeenCalledWith(adminUser, {
      filter: "dispatch_not_started",
      search: undefined,
      scheduledFrom: undefined,
      scheduledTo: undefined,
    });
  });

  it("forwards filter, q, from, and to query params to the read model", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request(
        "http://localhost/api/admin/bookings?filter=payment_failed&q=paystack_tx&from=2026-05-01&to=2026-05-31",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(listAdminBookingsMock).toHaveBeenCalledWith(adminUser, {
      filter: "payment_failed",
      search: "paystack_tx",
      scheduledFrom: "2026-05-01",
      scheduledTo: "2026-05-31",
    });
    expect(body).toMatchObject({
      matchTotal: 0,
      returnedCount: 0,
      limit: 200,
      capped: false,
    });
  });

  it("does not expose mutation handlers on the list route", async () => {
    const { GET } = await import("./route");
    const routeModule = await import("./route");
    expect(typeof GET).toBe("function");
    expect("POST" in routeModule).toBe(false);
    expect("PUT" in routeModule).toBe(false);
    expect("PATCH" in routeModule).toBe(false);
    expect("DELETE" in routeModule).toBe(false);
  });
});
