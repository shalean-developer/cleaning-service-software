import { describe, expect, it } from "vitest";
import { InMemoryBookingCommandBackend } from "./inMemoryBookingCommandBackend";
import { executeBookingCommand } from "./executeBookingCommand";
import { buildCronExpireOfferAuditIdempotencyKey } from "@/features/assignments/server/recordAssignmentOfferExpiredAudit";

const serviceActor = { actorType: "service" as const, profileId: null };

describe("RECORD_ASSIGNMENT_OFFER_EXPIRED", () => {
  it("writes audit row only without changing booking status", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = crypto.randomUUID();
    const offerId = crypto.randomUUID();
    const ts = new Date().toISOString();

    await backend.insertBooking({
      id: bookingId,
      customer_id: "cust-1",
      cleaner_id: null,
      service_id: null,
      status: "pending_assignment",
      scheduled_start: ts,
      scheduled_end: ts,
      price_cents: 1000,
      currency: "ZAR",
      series_id: null,
      metadata: {},
      created_at: ts,
      updated_at: ts,
    });

    await backend.insertOffer({
      id: offerId,
      booking_id: bookingId,
      cleaner_id: "cleaner-1",
      status: "expired",
      offered_at: ts,
      responded_at: null,
      expires_at: ts,
      created_at: ts,
      updated_at: ts,
    });

    const beforeNotifications = backend.notifications.length;

    const result = await executeBookingCommand(backend, {
      type: "RECORD_ASSIGNMENT_OFFER_EXPIRED",
      actor: serviceActor,
      bookingId,
      offerId,
      cleanerId: "cleaner-1",
      expiredAt: ts,
      idempotencyKey: buildCronExpireOfferAuditIdempotencyKey(offerId),
      metadata: {
        offerId,
        cleanerId: "cleaner-1",
        expiredAt: ts,
        expirySource: "cron",
        previousOfferStatus: "offered",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.idempotent).toBe(false);
    expect(result.status).toBe("pending_assignment");

    const booking = await backend.getBooking(bookingId);
    expect(booking?.status).toBe("pending_assignment");

    const audits = backend.audits.filter((a) => a.booking_id === bookingId);
    expect(audits).toHaveLength(1);
    expect(audits[0]?.command).toBe("RECORD_ASSIGNMENT_OFFER_EXPIRED");
    expect(audits[0]?.from_status).toBe("pending_assignment");
    expect(audits[0]?.to_status).toBe("pending_assignment");
    expect(audits[0]?.idempotency_key).toBe(`cron:expire-offer:${offerId}`);
    expect(backend.notifications.length).toBe(beforeNotifications);
  });

  it("is idempotent on rerun with the same key", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = crypto.randomUUID();
    const offerId = crypto.randomUUID();
    const ts = new Date().toISOString();

    await backend.insertBooking({
      id: bookingId,
      customer_id: "cust-1",
      cleaner_id: null,
      service_id: null,
      status: "pending_assignment",
      scheduled_start: ts,
      scheduled_end: ts,
      price_cents: 1000,
      currency: "ZAR",
      series_id: null,
      metadata: {},
      created_at: ts,
      updated_at: ts,
    });

    await backend.insertOffer({
      id: offerId,
      booking_id: bookingId,
      cleaner_id: "cleaner-1",
      status: "expired",
      offered_at: ts,
      responded_at: null,
      expires_at: ts,
      created_at: ts,
      updated_at: ts,
    });

    const cmd = {
      type: "RECORD_ASSIGNMENT_OFFER_EXPIRED" as const,
      actor: serviceActor,
      bookingId,
      offerId,
      cleanerId: "cleaner-1",
      expiredAt: ts,
      idempotencyKey: buildCronExpireOfferAuditIdempotencyKey(offerId),
    };

    const first = await executeBookingCommand(backend, cmd);
    const second = await executeBookingCommand(backend, cmd);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.idempotent).toBe(true);
    expect(backend.audits.filter((a) => a.command === "RECORD_ASSIGNMENT_OFFER_EXPIRED")).toHaveLength(
      1,
    );
  });

  it("rejects when offer is not yet expired", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = crypto.randomUUID();
    const offerId = crypto.randomUUID();
    const ts = new Date().toISOString();

    await backend.insertBooking({
      id: bookingId,
      customer_id: "cust-1",
      cleaner_id: null,
      service_id: null,
      status: "pending_assignment",
      scheduled_start: ts,
      scheduled_end: ts,
      price_cents: 1000,
      currency: "ZAR",
      series_id: null,
      metadata: {},
      created_at: ts,
      updated_at: ts,
    });

    await backend.insertOffer({
      id: offerId,
      booking_id: bookingId,
      cleaner_id: "cleaner-1",
      status: "offered",
      offered_at: ts,
      responded_at: null,
      expires_at: ts,
      created_at: ts,
      updated_at: ts,
    });

    const result = await executeBookingCommand(backend, {
      type: "RECORD_ASSIGNMENT_OFFER_EXPIRED",
      actor: serviceActor,
      bookingId,
      offerId,
      cleanerId: "cleaner-1",
      expiredAt: ts,
      idempotencyKey: buildCronExpireOfferAuditIdempotencyKey(offerId),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("OFFER_NOT_OPEN");
    expect(backend.audits).toHaveLength(0);
  });
});
