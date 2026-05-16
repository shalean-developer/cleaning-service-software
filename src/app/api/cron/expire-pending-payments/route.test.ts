import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const expireMock = vi.fn();
const createServiceRoleClientMock = vi.fn();
const createBookingCommandBackendMock = vi.fn();

vi.mock("@/features/payments/server/expirePendingPayments", () => ({
  expireStalePendingPayments: (...args: unknown[]) => expireMock(...args),
}));

vi.mock("@/lib/supabase/serviceRole", () => ({
  createServiceRoleClient: () => createServiceRoleClientMock(),
}));

vi.mock("@/features/bookings/server/commands/runBookingCommand", () => ({
  createBookingCommandBackend: () => createBookingCommandBackendMock(),
}));

describe("GET /api/cron/expire-pending-payments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-test-secret";
    createServiceRoleClientMock.mockReturnValue({});
    createBookingCommandBackendMock.mockReturnValue({});
    expireMock.mockResolvedValue({
      scanned: 3,
      expired: 1,
      skipped: {
        paid: 0,
        notYetDue: 2,
        wrongBookingStatus: 0,
        alreadyFailed: 0,
        commandRejected: 0,
      },
      errors: [],
    });
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("returns 401 without cron secret", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/cron/expire-pending-payments"),
    );
    expect(response.status).toBe(401);
    expect(expireMock).not.toHaveBeenCalled();
  });

  it("runs expiry processor with valid bearer secret", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/cron/expire-pending-payments", {
        headers: { authorization: "Bearer cron-test-secret" },
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.scanned).toBe(3);
    expect(body.expired).toBe(1);
    expect(body.skipped.notYetDue).toBe(2);
    expect(expireMock).toHaveBeenCalledOnce();
  });
});
