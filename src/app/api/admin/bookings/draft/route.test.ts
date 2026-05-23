import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/types";

const requireApiUserMock = vi.fn();
const adminCreateBookingDraftFacadeMock = vi.fn();

vi.mock("@/features/dashboards/server/apiAuth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
  isApiAuthFailure: (user: unknown) =>
    typeof user === "object" && user !== null && "ok" in user && (user as { ok: boolean }).ok === false,
}));

vi.mock("@/features/bookings/server/admin/adminCreateBookingDraftFacade", () => ({
  adminCreateBookingDraftFacade: (...args: unknown[]) => adminCreateBookingDraftFacadeMock(...args),
}));

const adminUser: CurrentUser = {
  profileId: "profile-admin",
  role: "admin",
  authUser: { id: "auth-admin" } as CurrentUser["authUser"],
};

function validBody() {
  const start = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
  const end = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString();
  return {
    customerId: "11111111-1111-4111-8111-111111111111",
    idempotencyKey: "api-test-idem-key-001",
    scheduledStart: start,
    scheduledEnd: end,
    pricingInput: {
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
      frequency: "once",
    },
    address: {
      addressLine1: "12 Main Rd",
      suburb: "Sea Point",
      city: "Cape Town",
    },
  };
}

describe("POST /api/admin/bookings/draft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue(adminUser);
    adminCreateBookingDraftFacadeMock.mockResolvedValue({
      ok: true,
      bookingDraft: {
        bookingId: "booking-1",
        status: "draft",
        priceCents: 120000,
        currency: "ZAR",
        idempotent: false,
      },
    });
  });

  it("returns 403 for non-admin auth failure", async () => {
    requireApiUserMock.mockResolvedValue({
      ok: false,
      status: 403,
      error: "FORBIDDEN",
      message: "Admins only.",
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/bookings/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody()),
      }),
    );

    expect(response.status).toBe(403);
    expect(adminCreateBookingDraftFacadeMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid Zod payload", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/bookings/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: "not-a-uuid" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(adminCreateBookingDraftFacadeMock).not.toHaveBeenCalled();
  });

  it("returns ok with bookingDraft for valid admin request", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/bookings/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody()),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.bookingDraft.status).toBe("draft");
    expect(adminCreateBookingDraftFacadeMock).toHaveBeenCalledOnce();
  });

  it("does not export GET on the draft route", async () => {
    const routeModule = await import("./route");
    expect(typeof routeModule.POST).toBe("function");
    expect("GET" in routeModule).toBe(false);
  });
});
