import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/types";

const requireApiUserMock = vi.fn();
const exportAdminBookingsCsvMock = vi.fn();

vi.mock("@/features/dashboards/server/apiAuth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
  isApiAuthFailure: (user: unknown) =>
    typeof user === "object" && user !== null && "ok" in user && (user as { ok: boolean }).ok === false,
}));

vi.mock("@/features/dashboards/server/adminOperationsReadModel", () => ({
  exportAdminBookingsCsv: (...args: unknown[]) => exportAdminBookingsCsvMock(...args),
}));

const adminUser: CurrentUser = {
  profileId: "profile-admin",
  role: "admin",
  authUser: { id: "auth-admin" } as CurrentUser["authUser"],
};

describe("GET /api/admin/export/bookings.csv", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue(adminUser);
    exportAdminBookingsCsvMock.mockResolvedValue({
      ok: true,
      csv: "booking_id,booking_reference\nb1,ref1\n",
      filename: "bookings-export-all-20260517T120000Z.csv",
      returnedCount: 1,
      matchTotal: 600,
      truncated: true,
    });
  });

  it("returns 403 for non-admin", async () => {
    requireApiUserMock.mockResolvedValue({
      ok: false,
      status: 403,
      error: "FORBIDDEN",
      message: "Admins only.",
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/admin/export/bookings.csv"));
    expect(response.status).toBe(403);
    expect(exportAdminBookingsCsvMock).not.toHaveBeenCalled();
  });

  it("forwards filter, q, from, and to to export read model", async () => {
    const { GET } = await import("./route");
    await GET(
      new Request(
        "http://localhost/api/admin/export/bookings.csv?filter=payment_failed&q=acme&from=2026-05-01&to=2026-05-31",
      ),
    );

    expect(exportAdminBookingsCsvMock).toHaveBeenCalledWith(adminUser, {
      filter: "payment_failed",
      search: "acme",
      scheduledFrom: "2026-05-01",
      scheduledTo: "2026-05-31",
    });
  });

  it("returns csv with attachment disposition and truncation headers", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/admin/export/bookings.csv?filter=max_attempts"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toContain(
      'attachment; filename="bookings-export-all-20260517T120000Z.csv"',
    );
    expect(response.headers.get("X-Export-Truncated")).toBe("true");
    expect(response.headers.get("X-Export-Returned-Count")).toBe("1");
    expect(response.headers.get("X-Export-Match-Total")).toBe("600");
    expect(response.headers.get("X-Export-Cap")).toBe("500");
    await expect(response.text()).resolves.toContain("booking_id");
  });

  it("does not expose mutation handlers", async () => {
    const routeModule = await import("./route");
    expect(typeof routeModule.GET).toBe("function");
    expect("POST" in routeModule).toBe(false);
    expect("PUT" in routeModule).toBe(false);
    expect("PATCH" in routeModule).toBe(false);
    expect("DELETE" in routeModule).toBe(false);
  });
});
