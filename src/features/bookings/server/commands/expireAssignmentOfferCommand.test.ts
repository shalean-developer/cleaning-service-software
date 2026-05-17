import { describe, expect, it } from "vitest";
import { InMemoryBookingCommandBackend } from "./inMemoryBookingCommandBackend";
import { executeBookingCommand } from "./executeBookingCommand";
import { buildCronExpireOfferAuditIdempotencyKey } from "@/features/assignments/server/recordAssignmentOfferExpiredAudit";

const serviceActor = { actorType: "service" as const, profileId: null };

function futureExpiry(): string {
  return new Date(Date.now() + 86_400_000).toISOString();
}

function pastExpiry(): string {
  return new Date(Date.now() - 86_400_000).toISOString();
}

describe("EXPIRE_ASSIGNMENT_OFFER", () => {
  it("expires offered stale offer and appends audit", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = crypto.randomUUID();
    const offerId = crypto.randomUUID();
    const ts = new Date().toISOString();
    const expiredAt = new Date().toISOString();

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
      expires_at: pastExpiry(),
      created_at: ts,
      updated_at: ts,
    });

    const beforeNotifications = backend.notifications.length;

    const result = await executeBookingCommand(backend, {
      type: "EXPIRE_ASSIGNMENT_OFFER",
      actor: serviceActor,
      bookingId,
      offerId,
      cleanerId: "cleaner-1",
      expiredAt,
      idempotencyKey: buildCronExpireOfferAuditIdempotencyKey(offerId),
      metadata: {
        offerId,
        cleanerId: "cleaner-1",
        expiredAt,
        expirySource: "cron",
        previousOfferStatus: "offered",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.idempotent).toBe(false);
    expect(result.status).toBe("pending_assignment");
    expect((await backend.getOffer(offerId))?.status).toBe("expired");

    const audits = backend.audits.filter((a) => a.booking_id === bookingId);
    expect(audits).toHaveLength(1);
    expect(audits[0]?.command).toBe("EXPIRE_ASSIGNMENT_OFFER");
    expect(audits[0]?.idempotency_key).toBe(`cron:expire-offer:${offerId}`);
    expect(backend.notifications.length).toBe(beforeNotifications);
  });

  it("is idempotent on rerun with the same key", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = crypto.randomUUID();
    const offerId = crypto.randomUUID();
    const ts = new Date().toISOString();
    const expiredAt = new Date().toISOString();

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
      expires_at: pastExpiry(),
      created_at: ts,
      updated_at: ts,
    });

    const cmd = {
      type: "EXPIRE_ASSIGNMENT_OFFER" as const,
      actor: serviceActor,
      bookingId,
      offerId,
      cleanerId: "cleaner-1",
      expiredAt,
      idempotencyKey: buildCronExpireOfferAuditIdempotencyKey(offerId),
    };

    const first = await executeBookingCommand(backend, cmd);
    const second = await executeBookingCommand(backend, cmd);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.idempotent).toBe(true);
    expect(backend.audits.filter((a) => a.command === "EXPIRE_ASSIGNMENT_OFFER")).toHaveLength(1);
  });

  it("returns idempotent success when offer is already expired", async () => {
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
      expires_at: pastExpiry(),
      created_at: ts,
      updated_at: ts,
    });

    const result = await executeBookingCommand(backend, {
      type: "EXPIRE_ASSIGNMENT_OFFER",
      actor: serviceActor,
      bookingId,
      offerId,
      cleanerId: "cleaner-1",
      expiredAt: ts,
      idempotencyKey: buildCronExpireOfferAuditIdempotencyKey(offerId),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.idempotent).toBe(true);
    expect(backend.audits).toHaveLength(0);
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
      expires_at: futureExpiry(),
      created_at: ts,
      updated_at: ts,
    });

    const result = await executeBookingCommand(backend, {
      type: "EXPIRE_ASSIGNMENT_OFFER",
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
    expect((await backend.getOffer(offerId))?.status).toBe("offered");
    expect(backend.audits).toHaveLength(0);
  });

  it.each(["accepted", "declined", "cancelled"] as const)(
    "rejects when offer is %s",
    async (status) => {
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
        status,
        offered_at: ts,
        responded_at: ts,
        expires_at: pastExpiry(),
        created_at: ts,
        updated_at: ts,
      });

      const result = await executeBookingCommand(backend, {
        type: "EXPIRE_ASSIGNMENT_OFFER",
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
    },
  );
});
