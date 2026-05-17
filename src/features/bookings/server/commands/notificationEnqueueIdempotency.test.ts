import { describe, expect, it } from "vitest";
import { executeBookingCommand } from "./executeBookingCommand";
import { InMemoryBookingCommandBackend } from "./inMemoryBookingCommandBackend";
import { shouldEnqueueNotificationForCommandResult } from "./shouldEnqueueNotificationForCommandResult";

const systemActor = { actorType: "system" as const, profileId: null };
const adminActor = { actorType: "admin" as const, profileId: "admin-profile" };
const cleanerActor = (profileId: string) =>
  ({ actorType: "cleaner" as const, profileId }) as const;

function templateCount(
  backend: InMemoryBookingCommandBackend,
  template: string,
): number {
  return backend.notifications.filter(
    (n) => (n.payload as { template?: string }).template === template,
  ).length;
}

async function seedConfirmedWithPayment(
  backend: InMemoryBookingCommandBackend,
  custId: string,
): Promise<{ bookingId: string; paymentId: string }> {
  const draft = await executeBookingCommand(
    backend,
    {
      type: "CREATE_BOOKING_DRAFT",
      actor: adminActor,
      customerId: custId,
      scheduledStart: new Date().toISOString(),
      scheduledEnd: new Date(Date.now() + 3600_000).toISOString(),
      priceCents: 8000,
    },
    {},
  );
  if (!draft.ok) throw new Error("draft");
  const bookingId = draft.bookingId;

  await executeBookingCommand(
    backend,
    {
      type: "MARK_PAYMENT_PENDING",
      actor: adminActor,
      bookingId,
      paymentIdempotencyKey: `pay-${custId}`,
    },
    {},
  );
  const paymentId = [...backend.payments.values()][0]!.id;

  const fin = await executeBookingCommand(
    backend,
    {
      type: "FINALIZE_PAYMENT_SUCCESS",
      actor: systemActor,
      bookingId,
      paymentId,
      idempotencyKey: `finalize-${custId}`,
    },
    {},
  );
  if (!fin.ok) throw new Error("finalize");

  return { bookingId, paymentId };
}

describe("shouldEnqueueNotificationForCommandResult", () => {
  it("returns false when command result is idempotent", () => {
    expect(shouldEnqueueNotificationForCommandResult(true)).toBe(false);
  });

  it("returns true when command result is not idempotent", () => {
    expect(shouldEnqueueNotificationForCommandResult(false)).toBe(true);
  });
});

describe("notification enqueue idempotency (executeBookingCommand)", () => {
  it("does not enqueue duplicate payment_confirmed on idempotent finalize", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const { bookingId, paymentId } = await seedConfirmedWithPayment(backend, "cust-fin-dup");

    expect(templateCount(backend, "payment_confirmed")).toBe(1);

    const dup = await executeBookingCommand(
      backend,
      {
        type: "FINALIZE_PAYMENT_SUCCESS",
        actor: systemActor,
        bookingId,
        paymentId,
        idempotencyKey: "finalize-cust-fin-dup",
      },
      {},
    );
    expect(dup.ok).toBe(true);
    if (!dup.ok) throw new Error("dup");
    expect(dup.idempotent).toBe(true);
    expect(templateCount(backend, "payment_confirmed")).toBe(1);
  });

  it("enqueues payment_confirmed on first successful finalize", async () => {
    const backend = new InMemoryBookingCommandBackend();
    await seedConfirmedWithPayment(backend, "cust-fin-first");
    expect(templateCount(backend, "payment_confirmed")).toBe(1);
  });

  it("does not enqueue payment_failed when MARK_PAYMENT_FAILED RPC is idempotent", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const custId = "cust-fail-dup";
    const draft = await executeBookingCommand(
      backend,
      {
        type: "CREATE_BOOKING_DRAFT",
        actor: adminActor,
        customerId: custId,
        scheduledStart: new Date().toISOString(),
        scheduledEnd: new Date(Date.now() + 3600_000).toISOString(),
        priceCents: 5000,
      },
      {},
    );
    if (!draft.ok) throw new Error("draft");
    await executeBookingCommand(
      backend,
      {
        type: "MARK_PAYMENT_PENDING",
        actor: adminActor,
        bookingId: draft.bookingId,
        paymentIdempotencyKey: "pay-fail",
      },
      {},
    );
    const paymentId = [...backend.payments.values()][0]!.id;

    await backend.appendAudit(
      {
        type: "MARK_PAYMENT_FAILED",
        actor: systemActor,
        bookingId: draft.bookingId,
        paymentId,
        idempotencyKey: "fail-key-1",
      },
      draft.bookingId,
      "pending_payment",
      "payment_failed",
    );

    const replay = await executeBookingCommand(
      backend,
      {
        type: "MARK_PAYMENT_FAILED",
        actor: systemActor,
        bookingId: draft.bookingId,
        paymentId,
        idempotencyKey: "fail-key-1",
      },
      {},
    );
    expect(replay.ok).toBe(true);
    if (!replay.ok) throw new Error("replay");
    expect(replay.idempotent).toBe(true);
    expect(templateCount(backend, "payment_failed")).toBe(0);
  });

  it("enqueues payment_failed on first successful MARK_PAYMENT_FAILED", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const custId = "cust-fail-first";
    const draft = await executeBookingCommand(
      backend,
      {
        type: "CREATE_BOOKING_DRAFT",
        actor: adminActor,
        customerId: custId,
        scheduledStart: new Date().toISOString(),
        scheduledEnd: new Date(Date.now() + 3600_000).toISOString(),
        priceCents: 5000,
      },
      {},
    );
    if (!draft.ok) throw new Error("draft");
    await executeBookingCommand(
      backend,
      {
        type: "MARK_PAYMENT_PENDING",
        actor: adminActor,
        bookingId: draft.bookingId,
        paymentIdempotencyKey: "pay-fail-first",
      },
      {},
    );
    const paymentId = [...backend.payments.values()][0]!.id;

    const first = await executeBookingCommand(
      backend,
      {
        type: "MARK_PAYMENT_FAILED",
        actor: systemActor,
        bookingId: draft.bookingId,
        paymentId,
        idempotencyKey: "fail-key-first",
      },
      {},
    );
    expect(first.ok).toBe(true);
    expect(templateCount(backend, "payment_failed")).toBe(1);
  });

  it("does not enqueue pending_assignment when MOVE_TO_PENDING_ASSIGNMENT is idempotent", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const { bookingId } = await seedConfirmedWithPayment(backend, "cust-move-dup");

    await backend.appendAudit(
      {
        type: "MOVE_TO_PENDING_ASSIGNMENT",
        actor: systemActor,
        bookingId,
        idempotencyKey: "move-pa-1",
      },
      bookingId,
      "confirmed",
      "pending_assignment",
    );

    const replay = await executeBookingCommand(
      backend,
      {
        type: "MOVE_TO_PENDING_ASSIGNMENT",
        actor: systemActor,
        bookingId,
        idempotencyKey: "move-pa-1",
      },
      {},
    );
    expect(replay.ok).toBe(true);
    if (!replay.ok) throw new Error("replay");
    expect(replay.idempotent).toBe(true);
    expect(templateCount(backend, "pending_assignment")).toBe(0);
  });

  it("enqueues pending_assignment on first successful MOVE_TO_PENDING_ASSIGNMENT", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const { bookingId } = await seedConfirmedWithPayment(backend, "cust-move-first");

    const first = await executeBookingCommand(
      backend,
      {
        type: "MOVE_TO_PENDING_ASSIGNMENT",
        actor: systemActor,
        bookingId,
      },
      {},
    );
    expect(first.ok).toBe(true);
    expect(templateCount(backend, "pending_assignment")).toBe(1);
  });

  it("does not enqueue duplicate assignment_offer on idempotent OFFER_TO_CLEANER", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const { bookingId } = await seedConfirmedWithPayment(backend, "cust-offer-dup");
    await executeBookingCommand(
      backend,
      {
        type: "MOVE_TO_PENDING_ASSIGNMENT",
        actor: systemActor,
        bookingId,
      },
      {},
    );

    const cleanerId = "cleaner-offer-a";
    const first = await executeBookingCommand(
      backend,
      {
        type: "OFFER_TO_CLEANER",
        actor: systemActor,
        bookingId,
        cleanerId,
      },
      {},
    );
    expect(first.ok).toBe(true);
    expect(templateCount(backend, "assignment_offer")).toBe(1);

    const second = await executeBookingCommand(
      backend,
      {
        type: "OFFER_TO_CLEANER",
        actor: systemActor,
        bookingId,
        cleanerId,
      },
      {},
    );
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error("second");
    expect(second.idempotent).toBe(true);
    expect(templateCount(backend, "assignment_offer")).toBe(1);
  });

  it("does not enqueue duplicate cleaner_assigned on idempotent ACCEPT_CLEANER_ASSIGNMENT", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const custId = "cust-accept-dup";
    const { bookingId } = await seedConfirmedWithPayment(backend, custId);
    await executeBookingCommand(
      backend,
      {
        type: "MOVE_TO_PENDING_ASSIGNMENT",
        actor: systemActor,
        bookingId,
      },
      {},
    );

    const cleanerId = "cleaner-accept";
    const offer = await executeBookingCommand(
      backend,
      {
        type: "OFFER_TO_CLEANER",
        actor: systemActor,
        bookingId,
        cleanerId,
      },
      {},
    );
    if (!offer.ok) throw new Error("offer");
    const offerId = [...backend.offers.values()].find((o) => o.cleaner_id === cleanerId)!.id;

    const first = await executeBookingCommand(
      backend,
      {
        type: "ACCEPT_CLEANER_ASSIGNMENT",
        actor: cleanerActor("cln-profile"),
        bookingId,
        offerId,
      },
      { actingCleanerId: cleanerId },
    );
    expect(first.ok).toBe(true);
    expect(templateCount(backend, "cleaner_assigned")).toBe(1);

    const second = await executeBookingCommand(
      backend,
      {
        type: "ACCEPT_CLEANER_ASSIGNMENT",
        actor: cleanerActor("cln-profile"),
        bookingId,
        offerId,
      },
      { actingCleanerId: cleanerId },
    );
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error("second");
    expect(second.idempotent).toBe(true);
    expect(templateCount(backend, "cleaner_assigned")).toBe(1);
  });

  it("does not enqueue payment_pending when MARK_PAYMENT_PENDING is idempotent", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const custId = "cust-pending-dup";
    const draft = await executeBookingCommand(
      backend,
      {
        type: "CREATE_BOOKING_DRAFT",
        actor: adminActor,
        customerId: custId,
        scheduledStart: new Date().toISOString(),
        scheduledEnd: new Date(Date.now() + 3600_000).toISOString(),
        priceCents: 4000,
      },
      {},
    );
    if (!draft.ok) throw new Error("draft");

    const key = "pay-pending-same";
    await executeBookingCommand(
      backend,
      {
        type: "MARK_PAYMENT_PENDING",
        actor: adminActor,
        bookingId: draft.bookingId,
        paymentIdempotencyKey: key,
      },
      {},
    );
    expect(templateCount(backend, "payment_pending")).toBe(1);

    const dup = await executeBookingCommand(
      backend,
      {
        type: "MARK_PAYMENT_PENDING",
        actor: adminActor,
        bookingId: draft.bookingId,
        paymentIdempotencyKey: key,
      },
      {},
    );
    expect(dup.ok).toBe(true);
    if (!dup.ok) throw new Error("dup");
    expect(dup.idempotent).toBe(true);
    expect(templateCount(backend, "payment_pending")).toBe(1);
  });
});
