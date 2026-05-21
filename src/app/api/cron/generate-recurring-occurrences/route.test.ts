import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const generateMock = vi.fn();
const createServiceRoleClientMock = vi.fn();
const createBookingCommandBackendMock = vi.fn();
const recordRunMock = vi.fn();
const logRunMock = vi.fn();

vi.mock("@/features/recurring/generateRecurringOccurrences", () => ({
  generateRecurringOccurrences: (...args: unknown[]) => generateMock(...args),
}));

vi.mock("@/lib/supabase/serviceRole", () => ({
  createServiceRoleClient: () => createServiceRoleClientMock(),
}));

vi.mock("@/features/bookings/server/commands/runBookingCommand", () => ({
  createBookingCommandBackend: () => createBookingCommandBackendMock(),
}));

vi.mock("@/features/recurring/server/recordRecurringGenerationRun", () => ({
  deriveRecurringGenerationRunStatus: (result: { errors: number }, ok: boolean) => {
    if (!ok) return "failed";
    if (result.errors > 0) return "partial";
    return "success";
  },
  recordRecurringGenerationRun: (...args: unknown[]) => recordRunMock(...args),
  logRecurringGenerationRunConsole: (...args: unknown[]) => logRunMock(...args),
}));

describe("GET /api/cron/generate-recurring-occurrences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-test-secret";
    createServiceRoleClientMock.mockReturnValue({});
    createBookingCommandBackendMock.mockReturnValue({});
    generateMock.mockResolvedValue({
      seriesScanned: 2,
      created: 1,
      skippedExisting: 3,
      skippedAnchor: 0,
      skippedPaused: 0,
      skippedCancelled: 0,
      errors: 0,
      errorMessages: [],
    });
    recordRunMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("returns 401 without cron secret", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/cron/generate-recurring-occurrences"),
    );
    expect(response.status).toBe(401);
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("returns 401 with invalid cron secret", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/cron/generate-recurring-occurrences", {
        headers: { authorization: "Bearer wrong-secret" },
      }),
    );
    expect(response.status).toBe(401);
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("processes active series with valid bearer secret", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/cron/generate-recurring-occurrences", {
        headers: { authorization: "Bearer cron-test-secret" },
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.seriesScanned).toBe(2);
    expect(body.created).toBe(1);
    expect(body.skippedExisting).toBe(3);
    expect(body.runId).toBeTruthy();
    expect(generateMock).toHaveBeenCalledOnce();
    expect(recordRunMock).toHaveBeenCalledOnce();
  });
});
