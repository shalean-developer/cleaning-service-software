import { describe, expect, it } from "vitest";
import { InMemoryBookingCommandBackend } from "./inMemoryBookingCommandBackend";
import { executeBookingCommand } from "./executeBookingCommand";

describe("CREATE_RECURRING_OCCURRENCE", () => {
  it("creates pending_payment child linked to series", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const customerId = crypto.randomUUID();
    const seriesId = crypto.randomUUID();
    const start = "2026-06-15T08:00:00+02:00";
    const end = "2026-06-15T11:00:00+02:00";

    const result = await executeBookingCommand(backend, {
      type: "CREATE_RECURRING_OCCURRENCE",
      actor: { actorType: "service", profileId: null },
      customerId,
      seriesId,
      scheduledStart: start,
      scheduledEnd: end,
      priceCents: 53_100,
      currency: "ZAR",
      metadata: { quote: { input: { frequency: "weekly" } } },
      idempotencyKey: `recurring:${seriesId}:${start}`,
      reason: "test",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe("pending_payment");

    const booking = await backend.getBooking(result.bookingId);
    expect(booking?.series_id).toBe(seriesId);
    expect(booking?.status).toBe("pending_payment");
  });

  it("does not auto-dispatch — child stays pending_payment until paid", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const seriesId = crypto.randomUUID();
    const start = "2026-07-01T08:00:00+02:00";

    const result = await executeBookingCommand(backend, {
      type: "CREATE_RECURRING_OCCURRENCE",
      actor: { actorType: "service", profileId: null },
      customerId: crypto.randomUUID(),
      seriesId,
      scheduledStart: start,
      scheduledEnd: "2026-07-01T11:00:00+02:00",
      priceCents: 50_000,
      metadata: {},
      idempotencyKey: `recurring:${seriesId}:${start}`,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const booking = await backend.getBooking(result.bookingId);
    expect(booking?.status).toBe("pending_payment");
    expect(booking?.cleaner_id).toBeNull();
  });
});
