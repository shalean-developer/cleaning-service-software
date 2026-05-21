import { beforeEach, describe, expect, it, vi } from "vitest";

const findSeriesByIdMock = vi.fn();
const findBookingOccurrenceAtMock = vi.fn();
const updateSeriesNextOccurrenceMock = vi.fn();
const executeBookingCommandMock = vi.fn();

vi.mock("./bookingSeriesRepository", () => ({
  findSeriesById: (...args: unknown[]) => findSeriesByIdMock(...args),
  findBookingOccurrenceAt: (...args: unknown[]) => findBookingOccurrenceAtMock(...args),
  updateSeriesNextOccurrence: (...args: unknown[]) => updateSeriesNextOccurrenceMock(...args),
  listActiveSeriesForGeneration: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/features/bookings/server/commands/executeBookingCommand", () => ({
  executeBookingCommand: (...args: unknown[]) => executeBookingCommandMock(...args),
}));

const activeSeries = {
  id: "series-active",
  status: "active" as const,
  customer_id: "cust-1",
  frequency: "weekly" as const,
  anchor_scheduled_start: "2026-06-01T08:00:00+02:00",
  next_occurrence_at: "2026-06-08T08:00:00+02:00",
  price_cents: 10000,
  template_metadata: {},
};

describe("generateRecurringOccurrencesForSeries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateSeriesNextOccurrenceMock.mockResolvedValue(undefined);
    findBookingOccurrenceAtMock.mockResolvedValue(null);
    executeBookingCommandMock.mockResolvedValue({ ok: true });
  });

  it("skips paused series without creating children", async () => {
    findSeriesByIdMock.mockResolvedValue({ ...activeSeries, status: "paused" });
    const { generateRecurringOccurrencesForSeries } = await import("./generateRecurringOccurrences");
    const result = await generateRecurringOccurrencesForSeries({} as never, {} as never, "series-active", {
      now: new Date("2026-06-01T10:00:00Z"),
      horizonDays: 7,
    });
    expect(result.skippedPaused).toBe(1);
    expect(result.created).toBe(0);
    expect(executeBookingCommandMock).not.toHaveBeenCalled();
  });

  it("skips cancelled series without creating children", async () => {
    findSeriesByIdMock.mockResolvedValue({ ...activeSeries, status: "cancelled" });
    const { generateRecurringOccurrencesForSeries } = await import("./generateRecurringOccurrences");
    const result = await generateRecurringOccurrencesForSeries({} as never, {} as never, "series-active", {
      now: new Date("2026-06-01T10:00:00Z"),
      horizonDays: 7,
    });
    expect(result.skippedCancelled).toBe(1);
    expect(result.created).toBe(0);
  });

  it("skips duplicate slot safely when occurrence already exists", async () => {
    findSeriesByIdMock.mockResolvedValue(activeSeries);
    findBookingOccurrenceAtMock.mockResolvedValue({ id: "existing-booking" });
    const { generateRecurringOccurrencesForSeries } = await import("./generateRecurringOccurrences");
    const result = await generateRecurringOccurrencesForSeries({} as never, {} as never, "series-active", {
      now: new Date("2026-06-10T10:00:00Z"),
      horizonDays: 14,
    });
    expect(result.skippedExisting).toBeGreaterThan(0);
    expect(result.created).toBe(0);
    expect(executeBookingCommandMock).not.toHaveBeenCalled();
  });
});
