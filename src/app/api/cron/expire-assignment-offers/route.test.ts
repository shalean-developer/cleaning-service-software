import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const expireMock = vi.fn();
const createServiceRoleClientMock = vi.fn();
const createBookingCommandBackendMock = vi.fn();

vi.mock("@/features/assignments/server/expireOffers", () => ({
  expireStaleAssignmentOffers: (...args: unknown[]) => expireMock(...args),
}));

vi.mock("@/lib/supabase/serviceRole", () => ({
  createServiceRoleClient: () => createServiceRoleClientMock(),
}));

vi.mock("@/features/bookings/server/commands/runBookingCommand", () => ({
  createBookingCommandBackend: () => createBookingCommandBackendMock(),
}));

describe("GET /api/cron/expire-assignment-offers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-test-secret";
    createServiceRoleClientMock.mockReturnValue({});
    createBookingCommandBackendMock.mockReturnValue({});
    expireMock.mockResolvedValue({
      expiredCount: 2,
      bookingIds: ["b1"],
      redispatchedBookingIds: [],
      attentionBookingIds: ["b1"],
    });
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("returns 401 without cron secret", async () => {
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/cron/expire-assignment-offers"));
    expect(response.status).toBe(401);
    expect(expireMock).not.toHaveBeenCalled();
  });

  it("runs expiry processor with valid bearer secret", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/cron/expire-assignment-offers", {
        headers: { authorization: "Bearer cron-test-secret" },
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.expiredCount).toBe(2);
    expect(expireMock).toHaveBeenCalledOnce();
  });
});
