import { describe, expect, it } from "vitest";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import { InMemoryBookingCommandBackend } from "@/features/bookings/server/commands/inMemoryBookingCommandBackend";
import { buildBookingQuoteMetadata } from "@/features/pricing/server/metadata";
import { calculateQuote } from "@/features/pricing/server/calculateQuote";
import { computeEarningsForBooking } from "./computeEarningsForBooking";
import { recordEarningsForBooking } from "./recordEarningsForBooking";

const systemActor = { actorType: "system" as const, profileId: null };
const cleanerActor = { actorType: "cleaner" as const, profileId: "profile-cleaner-a" };
const adminActor = { actorType: "admin" as const, profileId: "profile-admin" };
const customerId = "customer-1";
const cleanerA = "cleaner-a";
const cleanerB = "cleaner-b";
const cleanerCtxA = { actingCleanerId: cleanerA };
const cleanerCtxB = { actingCleanerId: cleanerB };

async function paidAssignedInProgress(
  backend: InMemoryBookingCommandBackend,
  cleanerId: string,
  priceCents = 53_000,
): Promise<string> {
  const quote = calculateQuote({
    serviceSlug: "regular-cleaning",
    bedrooms: 2,
    bathrooms: 1,
    teamSize: 1,
  });
  if (!quote.ok) throw new Error("quote failed");

  const draft = await executeBookingCommand(
    backend,
    {
      type: "CREATE_BOOKING_DRAFT",
      actor: systemActor,
      customerId,
      scheduledStart: new Date(Date.now() + 86_400_000).toISOString(),
      scheduledEnd: new Date(Date.now() + 90_000_000).toISOString(),
      priceCents,
      metadata: buildBookingQuoteMetadata(
        { serviceSlug: "regular-cleaning", bedrooms: 2, bathrooms: 1, teamSize: 1 },
        quote.breakdown,
      ),
    },
    { actingCustomerId: customerId },
  );
  if (!draft.ok) throw new Error("draft failed");
  const bookingId = draft.bookingId;

  await executeBookingCommand(
    backend,
    {
      type: "MARK_PAYMENT_PENDING",
      actor: systemActor,
      bookingId,
      paymentIdempotencyKey: `pay-${bookingId}`,
    },
    { actingCustomerId: customerId },
  );

  const payment = [...backend.payments.values()][0]!;
  await executeBookingCommand(
    backend,
    {
      type: "FINALIZE_PAYMENT_SUCCESS",
      actor: systemActor,
      bookingId,
      paymentId: payment.id,
      idempotencyKey: `fin-${bookingId}`,
    },
    {},
  );

  await executeBookingCommand(
    backend,
    {
      type: "MOVE_TO_PENDING_ASSIGNMENT",
      actor: systemActor,
      bookingId,
    },
    {},
  );

  const offerId = crypto.randomUUID();
  const ts = new Date().toISOString();
  await backend.insertOffer({
    id: offerId,
    booking_id: bookingId,
    cleaner_id: cleanerId,
    status: "offered",
    offered_at: ts,
    responded_at: null,
    expires_at: null,
    created_at: ts,
    updated_at: ts,
  });

  await executeBookingCommand(
    backend,
    {
      type: "ACCEPT_CLEANER_ASSIGNMENT",
      actor: { actorType: "cleaner", profileId: "p" },
      bookingId,
      offerId,
    },
    { actingCleanerId: cleanerId },
  );

  await executeBookingCommand(
    backend,
    {
      type: "MARK_BOOKING_IN_PROGRESS",
      actor: cleanerActor,
      bookingId,
    },
    { actingCleanerId: cleanerId },
  );

  return bookingId;
}

describe("earnings and completion lifecycle", () => {
  it("assigned cleaner can complete booking and create earning_lines", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await paidAssignedInProgress(backend, cleanerA);

    const complete = await executeBookingCommand(
      backend,
      {
        type: "MARK_BOOKING_COMPLETED",
        actor: cleanerActor,
        bookingId,
        idempotencyKey: `complete-${bookingId}`,
      },
      cleanerCtxA,
    );
    expect(complete.ok).toBe(true);
    if (!complete.ok) return;
    expect(complete.status).toBe("completed");

    const lines = await backend.listEarningLinesForBooking(bookingId);
    expect(lines.length).toBe(1);
    expect(lines[0]!.payout_amount_cents).toBeGreaterThan(0);
    expect(lines[0]!.payout_amount_cents).toBeLessThanOrEqual(53_000);
    expect(lines[0]!.cleaner_id).toBe(cleanerA);
  });

  it("rejects unrelated cleaner completing booking", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await paidAssignedInProgress(backend, cleanerA);

    const complete = await executeBookingCommand(
      backend,
      {
        type: "MARK_BOOKING_COMPLETED",
        actor: cleanerActor,
        bookingId,
      },
      cleanerCtxB,
    );
    expect(complete.ok).toBe(false);
    if (complete.ok) return;
    expect(complete.code).toBe("FORBIDDEN");
  });

  it("rejects completion without in_progress", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await paidAssignedInProgress(backend, cleanerA);
    const booking = backend.bookings.get(bookingId)!;
    booking.status = "assigned";
    backend.bookings.set(bookingId, booking);

    const complete = await executeBookingCommand(
      backend,
      {
        type: "MARK_BOOKING_COMPLETED",
        actor: cleanerActor,
        bookingId,
      },
      cleanerCtxA,
    );
    expect(complete.ok).toBe(false);
    if (complete.ok) return;
    expect(complete.code).toBe("INVALID_TRANSITION");
  });

  it("payout never exceeds booking total", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await paidAssignedInProgress(backend, cleanerA, 53_000);
    const booking = (await backend.getBooking(bookingId))!;
    const computed = computeEarningsForBooking(booking);
    expect("payoutAmountCents" in computed).toBe(true);
    if ("payoutAmountCents" in computed) {
      expect(computed.payoutAmountCents).toBeLessThanOrEqual(booking.price_cents);
      expect(computed.payoutAmountCents).toBeGreaterThan(0);
    }
  });

  it("payout_ready requires earnings", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const quote = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
    });
    if (!quote.ok) throw new Error("quote");

    const draft = await executeBookingCommand(
      backend,
      {
        type: "CREATE_BOOKING_DRAFT",
        actor: systemActor,
        customerId,
        scheduledStart: new Date(Date.now() + 86_400_000).toISOString(),
        scheduledEnd: new Date(Date.now() + 90_000_000).toISOString(),
        priceCents: 53_000,
        metadata: buildBookingQuoteMetadata(
          { serviceSlug: "regular-cleaning", bedrooms: 2, bathrooms: 1 },
          quote.breakdown,
        ),
      },
      { actingCustomerId: customerId },
    );
    if (!draft.ok) throw new Error("draft");

    const booking = (await backend.getBooking(draft.bookingId))!;
    booking.status = "completed";
    backend.bookings.set(booking.id, booking);

    const ready = await executeBookingCommand(
      backend,
      {
        type: "MARK_BOOKING_PAYOUT_READY",
        actor: adminActor,
        bookingId: draft.bookingId,
      },
      {},
    );
    expect(ready.ok).toBe(false);
    if (ready.ok) return;
    expect(ready.code).toBe("EARNINGS_NOT_FOUND");
  });

  it("only admin can mark paid_out", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await paidAssignedInProgress(backend, cleanerA);

    await executeBookingCommand(
      backend,
      {
        type: "MARK_BOOKING_COMPLETED",
        actor: cleanerActor,
        bookingId,
      },
      cleanerCtxA,
    );

    const cleanerAttempt = await executeBookingCommand(
      backend,
      {
        type: "MARK_BOOKING_PAID_OUT",
        actor: cleanerActor,
        bookingId,
      },
      cleanerCtxA,
    );
    expect(cleanerAttempt.ok).toBe(false);
    if (cleanerAttempt.ok) return;
    expect(cleanerAttempt.code).toBe("FORBIDDEN");
  });

  it("idempotent completion does not duplicate earnings", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await paidAssignedInProgress(backend, cleanerA);

    const first = await executeBookingCommand(
      backend,
      {
        type: "MARK_BOOKING_COMPLETED",
        actor: cleanerActor,
        bookingId,
        idempotencyKey: `complete-${bookingId}`,
      },
      cleanerCtxA,
    );
    expect(first.ok).toBe(true);

    const second = await executeBookingCommand(
      backend,
      {
        type: "MARK_BOOKING_COMPLETED",
        actor: cleanerActor,
        bookingId,
        idempotencyKey: `complete-${bookingId}`,
      },
      cleanerCtxA,
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.idempotent).toBe(true);

    const lines = await backend.listEarningLinesForBooking(bookingId);
    expect(lines.filter((l) => l.line_type === "booking_completion")).toHaveLength(1);
  });

  it("admin payout_ready and paid_out flow updates earnings status", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await paidAssignedInProgress(backend, cleanerA);

    await executeBookingCommand(
      backend,
      {
        type: "MARK_BOOKING_COMPLETED",
        actor: cleanerActor,
        bookingId,
      },
      cleanerCtxA,
    );

    const ready = await executeBookingCommand(
      backend,
      {
        type: "MARK_BOOKING_PAYOUT_READY",
        actor: adminActor,
        bookingId,
      },
      {},
    );
    expect(ready.ok).toBe(true);

    let lines = await backend.listEarningLinesForBooking(bookingId);
    expect(lines[0]!.payout_status).toBe("payout_ready");

    const paid = await executeBookingCommand(
      backend,
      {
        type: "MARK_BOOKING_PAID_OUT",
        actor: adminActor,
        bookingId,
      },
      {},
    );
    expect(paid.ok).toBe(true);
    if (!paid.ok) return;
    expect(paid.status).toBe("paid_out");

    lines = await backend.listEarningLinesForBooking(bookingId);
    expect(lines[0]!.payout_status).toBe("paid");
  });

  it("recordEarningsForBooking is idempotent", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await paidAssignedInProgress(backend, cleanerA);
    const booking = (await backend.getBooking(bookingId))!;
    booking.status = "completed";
    backend.bookings.set(bookingId, booking);

    const first = await recordEarningsForBooking(backend, booking);
    const second = await recordEarningsForBooking(backend, booking);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);

    const lines = await backend.listEarningLinesForBooking(bookingId);
    expect(lines).toHaveLength(1);
  });

  it("creates audit rows on completion transitions", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await paidAssignedInProgress(backend, cleanerA);

    await executeBookingCommand(
      backend,
      {
        type: "MARK_BOOKING_COMPLETED",
        actor: cleanerActor,
        bookingId,
      },
      cleanerCtxA,
    );

    const commands = backend.audits
      .filter((a) => a.booking_id === bookingId)
      .map((a) => a.command);
    expect(commands).toContain("MARK_BOOKING_IN_PROGRESS");
    expect(commands).toContain("MARK_BOOKING_COMPLETED");
  });
});
