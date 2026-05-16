import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserMock = vi.fn();
const getAvailableCleanersMock = vi.fn();
const getBookingCleanersMock = vi.fn();
const executeBookingCommandMock = vi.fn();

vi.mock("@/lib/auth/getCurrentUser", () => ({
  getCurrentUser: () => getCurrentUserMock(),
}));

vi.mock("@/features/cleaners/server/getAvailableCleaners", () => ({
  getAvailableCleaners: (...args: unknown[]) => getAvailableCleanersMock(...args),
  getBookingCleaners: (...args: unknown[]) => getBookingCleanersMock(...args),
}));

vi.mock("@/features/bookings/server/commands/executeBookingCommand", () => ({
  executeBookingCommand: (...args: unknown[]) => executeBookingCommandMock(...args),
}));

describe("cleaner availability API routes", () => {
  let availableGet: typeof import("@/app/api/cleaners/available/route").GET;
  let bookingCleanersGet: typeof import("@/app/api/booking/cleaners/route").GET;

  beforeAll(async () => {
    ({ GET: availableGet } = await import("@/app/api/cleaners/available/route"));
    ({ GET: bookingCleanersGet } = await import("@/app/api/booking/cleaners/route"));
  }, 30_000);

  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserMock.mockResolvedValue({
      profileId: "user-1",
      role: "customer",
    });
    getAvailableCleanersMock.mockResolvedValue({
      ok: true,
      data: { cleaners: [], bestAvailable: null },
    });
    getBookingCleanersMock.mockResolvedValue({
      ok: true,
      data: { cleaners: [], bestAvailable: null, selectedCleaner: null },
    });
  });

  it("GET /api/cleaners/available returns quote without mutating bookings", async () => {
    const request = new Request(
      "http://localhost/api/cleaners/available?serviceSlug=regular-cleaning&date=2026-05-18&time=10:00&suburb=Cape%20Town",
    );

    const response = await availableGet(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(executeBookingCommandMock).not.toHaveBeenCalled();
    expect(getAvailableCleanersMock).toHaveBeenCalled();
  });

  it("GET /api/booking/cleaners returns booking eligibility without commands", async () => {
    const request = new Request(
      "http://localhost/api/booking/cleaners?bookingId=booking-1&serviceSlug=regular-cleaning&suburb=cape-town&date=2026-05-18&time=10:00",
    );

    const response = await bookingCleanersGet(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(executeBookingCommandMock).not.toHaveBeenCalled();
    expect(getBookingCleanersMock).toHaveBeenCalled();
  });
});
