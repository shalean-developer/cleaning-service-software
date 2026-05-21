import { describe, expect, it, vi, beforeEach } from "vitest";
import { InMemoryBookingCommandBackend } from "@/features/bookings/server/commands/inMemoryBookingCommandBackend";
import type { BookingRow } from "@/lib/database/types";

const insertGroupMock = vi.fn();
const insertSeriesMock = vi.fn();
const findGroupMock = vi.fn();
const findSeriesMock = vi.fn();
const linkMock = vi.fn();

vi.mock("./recurringScheduleGroupRepository", () => ({
  findScheduleGroupByAnchorBookingId: (...args: unknown[]) => findGroupMock(...args),
  insertRecurringScheduleGroup: (...args: unknown[]) => insertGroupMock(...args),
  listSeriesIdsForGroup: vi.fn().mockResolvedValue([]),
}));

vi.mock("./bookingSeriesRepository", () => ({
  findSeriesByCreatedFromBookingId: (...args: unknown[]) => findSeriesMock(...args),
  insertBookingSeries: (...args: unknown[]) => insertSeriesMock(...args),
  linkBookingToSeries: (...args: unknown[]) => linkMock(...args),
  resolveCustomerProfileId: vi.fn().mockResolvedValue(null),
}));

describe("materializeRecurringScheduleGroupFromBooking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findGroupMock.mockResolvedValue(null);
    findSeriesMock.mockResolvedValue(null);
    insertGroupMock.mockResolvedValue({
      id: "group-1",
      frequency: "weekly",
      selected_days: [1, 3, 5],
    });
    insertSeriesMock.mockImplementation(async (input: { weekday: number }) => ({
      id: `series-${input.weekday}`,
    }));
  });

  it("creates synthetic anchors for non-paid weekdays", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const booking: BookingRow = {
      id: "paid-1",
      customer_id: "cust-1",
      cleaner_id: null,
      service_id: null,
      status: "confirmed",
      scheduled_start: "2026-06-01T09:00:00+02:00",
      scheduled_end: "2026-06-01T12:00:00+02:00",
      assignment_dispatch_at: null,
      price_cents: 50_000,
      currency: "ZAR",
      series_id: null,
      synthetic_anchor: false,
      metadata: {
        quote: { input: { frequency: "weekly", serviceSlug: "regular-cleaning" } },
        recurringSchedule: { selectedDays: [1, 3, 5] },
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { materializeRecurringScheduleGroupFromBooking } = await import(
      "./materializeRecurringScheduleGroup"
    );
    const result = await materializeRecurringScheduleGroupFromBooking(
      {} as never,
      backend,
      booking,
    );

    expect(result.ok).toBe(true);
    if (!result.ok || !result.materialized) return;
    expect(result.seriesIds).toHaveLength(3);
    const synthetic = [...backend.bookings.values()].filter((b) => b.synthetic_anchor);
    expect(synthetic).toHaveLength(2);
    expect(synthetic.every((b) => b.status === "cancelled")).toBe(true);
  });
});
