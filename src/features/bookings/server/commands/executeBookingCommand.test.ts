import { describe, expect, it } from "vitest";
import { forbidBookingStatusInPatch } from "@/features/bookings/server/directMutationGuard";
import {
  assertTransitionShape,
  nextStatusForCommand,
} from "@/features/bookings/server/commands/bookingCommandGuards";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import { InMemoryBookingCommandBackend } from "@/features/bookings/server/commands/inMemoryBookingCommandBackend";

const systemActor = { actorType: "system" as const, profileId: null };
const adminActor = { actorType: "admin" as const, profileId: "admin-profile" };
const customerActor = (profileId: string) =>
  ({ actorType: "customer" as const, profileId }) as const;
const cleanerActor = (profileId: string) =>
  ({ actorType: "cleaner" as const, profileId }) as const;

async function seedPendingAssignmentBooking(
  backend: InMemoryBookingCommandBackend,
  custId: string,
): Promise<string> {
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
  await executeBookingCommand(
    backend,
    {
      type: "FINALIZE_PAYMENT_SUCCESS",
      actor: systemActor,
      bookingId,
      paymentId: [...backend.payments.values()][0]!.id,
      idempotencyKey: `finalize-${custId}`,
    },
    {},
  );
  await executeBookingCommand(
    backend,
    { type: "MOVE_TO_PENDING_ASSIGNMENT", actor: systemActor, bookingId },
    {},
  );
  return bookingId;
}

describe("bookingCommandGuards", () => {
  it("blocks invalid transitions", () => {
    const cmd = {
      type: "FINALIZE_PAYMENT_SUCCESS" as const,
      actor: systemActor,
      bookingId: "b1",
      paymentId: "p1",
      idempotencyKey: "k1",
    };
    expect(assertTransitionShape(cmd, "draft")?.code).toBe("INVALID_TRANSITION");
  });

  it("allows payment_failed from pending_payment via MARK_PAYMENT_FAILED", () => {
    const cmd = {
      type: "MARK_PAYMENT_FAILED" as const,
      actor: systemActor,
      bookingId: "b1",
      paymentId: "p1",
    };
    expect(assertTransitionShape(cmd, "pending_payment")).toBeNull();
    expect(nextStatusForCommand(cmd, "pending_payment")).toBe("payment_failed");
  });

  it("allows MARK_PAYMENT_PENDING from payment_failed for retry", () => {
    const cmd = {
      type: "MARK_PAYMENT_PENDING" as const,
      actor: systemActor,
      bookingId: "b1",
      paymentIdempotencyKey: "retry-pay-1",
    };
    expect(assertTransitionShape(cmd, "payment_failed")).toBeNull();
    expect(nextStatusForCommand(cmd, "payment_failed")).toBe("pending_payment");
  });

  it("blocks MARK_PAYMENT_PENDING from completed and paid_out", () => {
    const cmd = {
      type: "MARK_PAYMENT_PENDING" as const,
      actor: systemActor,
      bookingId: "b1",
      paymentIdempotencyKey: "retry-pay-2",
    };
    expect(assertTransitionShape(cmd, "completed")?.code).toBe("INVALID_TRANSITION");
    expect(assertTransitionShape(cmd, "paid_out")?.code).toBe("TERMINAL_STATE");
    expect(assertTransitionShape(cmd, "cancelled")?.code).toBe("TERMINAL_STATE");
  });

  it("requires pending_assignment before OFFER_TO_CLEANER", () => {
    const cmd = {
      type: "OFFER_TO_CLEANER" as const,
      actor: systemActor,
      bookingId: "b1",
      cleanerId: "c1",
    };
    expect(assertTransitionShape(cmd, "confirmed")?.code).toBe("INVALID_TRANSITION");
    expect(assertTransitionShape(cmd, "pending_assignment")).toBeNull();
  });

  it("requires pending_assignment before CANCEL_OPEN_ASSIGNMENT_OFFER", () => {
    const cmd = {
      type: "CANCEL_OPEN_ASSIGNMENT_OFFER" as const,
      actor: adminActor,
      bookingId: "b1",
      offerId: "o1",
    };
    expect(assertTransitionShape(cmd, "confirmed")?.code).toBe("INVALID_TRANSITION");
    expect(assertTransitionShape(cmd, "pending_assignment")).toBeNull();
  });
});

describe("executeBookingCommand", () => {
  it("blocks pending_assignment when no paid payment exists (even if status is confirmed)", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const custId = "cust-x";
    const draft = await executeBookingCommand(
      backend,
      {
        type: "CREATE_BOOKING_DRAFT",
        actor: adminActor,
        customerId: custId,
        scheduledStart: new Date().toISOString(),
        scheduledEnd: new Date(Date.now() + 3600_000).toISOString(),
        priceCents: 1000,
      },
      {},
    );
    if (!draft.ok) throw new Error("draft");
    await executeBookingCommand(
      backend,
      {
        type: "ADMIN_OVERRIDE_STATUS",
        actor: adminActor,
        bookingId: draft.bookingId,
        nextStatus: "confirmed",
        reason: "inconsistent fixture for payment gate test",
      },
      {},
    );
    const move = await executeBookingCommand(
      backend,
      {
        type: "MOVE_TO_PENDING_ASSIGNMENT",
        actor: systemActor,
        bookingId: draft.bookingId,
      },
      {},
    );
    expect(move.ok).toBe(false);
    if (move.ok) throw new Error("expected failure");
    expect(move.code).toBe("PAYMENT_NOT_PAID");
  });

  it("runs happy-path lifecycle with paid gate before pending_assignment", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const custId = "cust-1";
    const draft = await executeBookingCommand(
      backend,
      {
        type: "CREATE_BOOKING_DRAFT",
        actor: customerActor("p-cust"),
        customerId: custId,
        scheduledStart: new Date().toISOString(),
        scheduledEnd: new Date(Date.now() + 3600_000).toISOString(),
        priceCents: 10_000,
      },
      { actingCustomerId: custId },
    );
    expect(draft.ok).toBe(true);
    if (!draft.ok) throw new Error("draft");
    const bookingId = draft.bookingId;

    await executeBookingCommand(
      backend,
      {
        type: "MARK_PAYMENT_PENDING",
        actor: customerActor("p-cust"),
        bookingId,
        paymentIdempotencyKey: "pay-init-1",
      },
      { actingCustomerId: custId },
    );

    const moveEarly = await executeBookingCommand(
      backend,
      {
        type: "MOVE_TO_PENDING_ASSIGNMENT",
        actor: systemActor,
        bookingId,
      },
      {},
    );
    expect(moveEarly.ok).toBe(false);
    if (moveEarly.ok) throw new Error("expected failure");
    expect(moveEarly.code).toBe("INVALID_TRANSITION");

    const fin = await executeBookingCommand(
      backend,
      {
        type: "FINALIZE_PAYMENT_SUCCESS",
        actor: systemActor,
        bookingId,
        paymentId: [...backend.payments.values()][0]!.id,
        idempotencyKey: "evt-abc",
      },
      {},
    );
    expect(fin.ok).toBe(true);

    const finDup = await executeBookingCommand(
      backend,
      {
        type: "FINALIZE_PAYMENT_SUCCESS",
        actor: systemActor,
        bookingId,
        paymentId: [...backend.payments.values()][0]!.id,
        idempotencyKey: "evt-abc",
      },
      {},
    );
    expect(finDup.ok).toBe(true);
    if (!finDup.ok) throw new Error("dup");
    expect(finDup.idempotent).toBe(true);

    const moveOk = await executeBookingCommand(
      backend,
      {
        type: "MOVE_TO_PENDING_ASSIGNMENT",
        actor: systemActor,
        bookingId,
      },
      {},
    );
    expect(moveOk.ok).toBe(true);
  });

  it("records admin override in audit", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const custId = "cust-2";
    const draft = await executeBookingCommand(
      backend,
      {
        type: "CREATE_BOOKING_DRAFT",
        actor: adminActor,
        customerId: custId,
        scheduledStart: new Date().toISOString(),
        scheduledEnd: new Date(Date.now() + 3600_000).toISOString(),
        priceCents: 5000,
        reason: "seed",
      },
      {},
    );
    if (!draft.ok) throw new Error("draft");
    const n = backend.audits.length;
    const ov = await executeBookingCommand(
      backend,
      {
        type: "ADMIN_OVERRIDE_STATUS",
        actor: adminActor,
        bookingId: draft.bookingId,
        nextStatus: "pending_assignment",
        reason: "support recovery",
      },
      {},
    );
    expect(ov.ok).toBe(true);
    expect(backend.audits.length).toBe(n + 1);
    expect(backend.audits.at(-1)?.command).toBe("ADMIN_OVERRIDE_STATUS");
  });

  it("prevents cleaner from accepting an already-assigned booking", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const custId = "cust-3";
    const cleanerProfile = "cl-profile";
    const cleanerId = "cleaner-uuid";
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
        paymentIdempotencyKey: "pay-2",
      },
      {},
    );
    await executeBookingCommand(
      backend,
      {
        type: "FINALIZE_PAYMENT_SUCCESS",
        actor: systemActor,
        bookingId,
        paymentId: [...backend.payments.values()][0]!.id,
        idempotencyKey: "e2",
      },
      {},
    );
    await executeBookingCommand(
      backend,
      { type: "MOVE_TO_PENDING_ASSIGNMENT", actor: systemActor, bookingId },
      {},
    );
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
    expect(offer.ok).toBe(true);
    const offerId = [...backend.offers.values()][0]!.id;
    await executeBookingCommand(
      backend,
      {
        type: "ACCEPT_CLEANER_ASSIGNMENT",
        actor: cleanerActor(cleanerProfile),
        bookingId,
        offerId,
      },
      { actingCleanerId: cleanerId },
    );

    const acceptAgain = await executeBookingCommand(
      backend,
      {
        type: "ACCEPT_CLEANER_ASSIGNMENT",
        actor: cleanerActor(cleanerProfile),
        bookingId,
        offerId,
      },
      { actingCleanerId: cleanerId },
    );
    expect(acceptAgain.ok).toBe(true);
    if (!acceptAgain.ok) throw new Error("expected idempotent accept");
    expect(acceptAgain.idempotent).toBe(true);
  });

  it("blocks OFFER_TO_CLEANER when another cleaner already has an open offer", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await seedPendingAssignmentBooking(backend, "cust-offer-race");
    const cleanerA = "cleaner-a";
    const cleanerB = "cleaner-b";

    const first = await executeBookingCommand(
      backend,
      {
        type: "OFFER_TO_CLEANER",
        actor: systemActor,
        bookingId,
        cleanerId: cleanerA,
        expiresAt: new Date(Date.now() + 48 * 3600_000).toISOString(),
      },
      {},
    );
    expect(first.ok).toBe(true);

    const second = await executeBookingCommand(
      backend,
      {
        type: "OFFER_TO_CLEANER",
        actor: systemActor,
        bookingId,
        cleanerId: cleanerB,
        expiresAt: new Date(Date.now() + 48 * 3600_000).toISOString(),
      },
      {},
    );
    expect(second.ok).toBe(false);
    if (second.ok) throw new Error("expected failure");
    expect(second.code).toBe("OPEN_OFFER_EXISTS");

    const offered = [...backend.offers.values()].filter((o) => o.status === "offered");
    expect(offered).toHaveLength(1);
    expect(offered[0]?.cleaner_id).toBe(cleanerA);
  });

  it("CANCEL_OPEN_ASSIGNMENT_OFFER cancels open offer for admin without assigning", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await seedPendingAssignmentBooking(backend, "cust-cancel-offer");
    const cleanerA = "cleaner-a";

    await executeBookingCommand(
      backend,
      {
        type: "OFFER_TO_CLEANER",
        actor: systemActor,
        bookingId,
        cleanerId: cleanerA,
        expiresAt: new Date(Date.now() + 48 * 3600_000).toISOString(),
      },
      {},
    );
    const offerId = [...backend.offers.values()][0]!.id;

    const forbidden = await executeBookingCommand(
      backend,
      {
        type: "CANCEL_OPEN_ASSIGNMENT_OFFER",
        actor: systemActor,
        bookingId,
        offerId,
        reason: "system should not cancel",
      },
      {},
    );
    expect(forbidden.ok).toBe(false);
    if (!forbidden.ok) expect(forbidden.code).toBe("FORBIDDEN");

    const cancel = await executeBookingCommand(
      backend,
      {
        type: "CANCEL_OPEN_ASSIGNMENT_OFFER",
        actor: adminActor,
        bookingId,
        offerId,
        reason: "Admin withdrew offer. no response",
      },
      {},
    );
    expect(cancel.ok).toBe(true);
    if (!cancel.ok) throw new Error("cancel failed");
    expect(cancel.idempotent).toBe(false);

    const row = backend.offers.get(offerId)!;
    expect(row.status).toBe("cancelled");
    expect(row.responded_at).toBeTruthy();

    const booking = await backend.getBooking(bookingId);
    expect(booking?.status).toBe("pending_assignment");
    expect(booking?.cleaner_id).toBeNull();

    const cancelAgain = await executeBookingCommand(
      backend,
      {
        type: "CANCEL_OPEN_ASSIGNMENT_OFFER",
        actor: adminActor,
        bookingId,
        offerId,
        reason: "Idempotent retry",
      },
      {},
    );
    expect(cancelAgain.ok).toBe(true);
    if (!cancelAgain.ok) throw new Error("cancel again");
    expect(cancelAgain.idempotent).toBe(true);
  });

  it("allows OFFER_TO_CLEANER after admin cancels prior open offer", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await seedPendingAssignmentBooking(backend, "cust-cancel-then-offer");
    const cleanerA = "cleaner-a";
    const cleanerB = "cleaner-b";

    await executeBookingCommand(
      backend,
      {
        type: "OFFER_TO_CLEANER",
        actor: systemActor,
        bookingId,
        cleanerId: cleanerA,
      },
      {},
    );
    const offerId = [...backend.offers.values()][0]!.id;
    await executeBookingCommand(
      backend,
      {
        type: "CANCEL_OPEN_ASSIGNMENT_OFFER",
        actor: adminActor,
        bookingId,
        offerId,
        reason: "Replacing with another cleaner",
      },
      {},
    );

    const second = await executeBookingCommand(
      backend,
      {
        type: "OFFER_TO_CLEANER",
        actor: systemActor,
        bookingId,
        cleanerId: cleanerB,
      },
      {},
    );
    expect(second.ok).toBe(true);
    const offered = [...backend.offers.values()].filter((o) => o.status === "offered");
    expect(offered).toHaveLength(1);
    expect(offered[0]?.cleaner_id).toBe(cleanerB);
  });

  it("allows OFFER_TO_CLEANER after prior offer is declined", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await seedPendingAssignmentBooking(backend, "cust-offer-redispatch");
    const cleanerA = "cleaner-a";
    const cleanerB = "cleaner-b";
    const cleanerProfileA = "profile-a";

    const first = await executeBookingCommand(
      backend,
      {
        type: "OFFER_TO_CLEANER",
        actor: systemActor,
        bookingId,
        cleanerId: cleanerA,
      },
      {},
    );
    expect(first.ok).toBe(true);
    const offerId = [...backend.offers.values()][0]!.id;

    const decline = await executeBookingCommand(
      backend,
      {
        type: "DECLINE_CLEANER_ASSIGNMENT",
        actor: cleanerActor(cleanerProfileA),
        bookingId,
        offerId,
      },
      { actingCleanerId: cleanerA },
    );
    expect(decline.ok).toBe(true);

    const second = await executeBookingCommand(
      backend,
      {
        type: "OFFER_TO_CLEANER",
        actor: systemActor,
        bookingId,
        cleanerId: cleanerB,
      },
      {},
    );
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error("expected second offer");

    const offered = [...backend.offers.values()].filter((o) => o.status === "offered");
    expect(offered).toHaveLength(1);
    expect(offered[0]?.cleaner_id).toBe(cleanerB);

    const historical = [...backend.offers.values()].filter((o) => o.status === "declined");
    expect(historical).toHaveLength(1);
  });

  it("expires stale offered rows before offering to another cleaner", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await seedPendingAssignmentBooking(backend, "cust-stale-offer");
    const cleanerA = "cleaner-a";
    const cleanerB = "cleaner-b";

    await executeBookingCommand(
      backend,
      {
        type: "OFFER_TO_CLEANER",
        actor: systemActor,
        bookingId,
        cleanerId: cleanerA,
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      },
      {},
    );

    const redispatch = await executeBookingCommand(
      backend,
      {
        type: "OFFER_TO_CLEANER",
        actor: systemActor,
        bookingId,
        cleanerId: cleanerB,
        expiresAt: new Date(Date.now() + 48 * 3600_000).toISOString(),
      },
      {},
    );
    expect(redispatch.ok).toBe(true);

    const rows = [...backend.offers.values()];
    expect(rows.filter((o) => o.status === "offered")).toHaveLength(1);
    expect(rows.find((o) => o.status === "offered")?.cleaner_id).toBe(cleanerB);
    expect(rows.some((o) => o.cleaner_id === cleanerA && o.status === "expired")).toBe(true);
  });

  it("forbids direct status patches at the application layer", () => {
    expect(() => forbidBookingStatusInPatch({ status: "completed" })).toThrow(
      /executeBookingCommand/,
    );
    expect(() => forbidBookingStatusInPatch({ price_cents: 1 })).not.toThrow();
  });

  it("allows MARK_PAYMENT_PENDING retry from payment_failed after checkout expiry", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const custId = "cust-retry-pay";
    const draft = await executeBookingCommand(
      backend,
      {
        type: "CREATE_BOOKING_DRAFT",
        actor: adminActor,
        customerId: custId,
        scheduledStart: new Date().toISOString(),
        scheduledEnd: new Date(Date.now() + 3600_000).toISOString(),
        priceCents: 9000,
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
        paymentIdempotencyKey: "pay-retry-1",
      },
      {},
    );
    const payment = [...backend.payments.values()][0]!;

    const failed = await executeBookingCommand(
      backend,
      {
        type: "MARK_PAYMENT_FAILED",
        actor: systemActor,
        bookingId,
        paymentId: payment.id,
        metadata: { failure_reason: "checkout_expired" },
      },
      {},
    );
    expect(failed.ok).toBe(true);

    const retry = await executeBookingCommand(
      backend,
      {
        type: "MARK_PAYMENT_PENDING",
        actor: adminActor,
        bookingId,
        paymentIdempotencyKey: "pay-retry-2",
      },
      {},
    );
    expect(retry.ok).toBe(true);
    if (!retry.ok) throw new Error("retry");
    expect(retry.status).toBe("pending_payment");
  });
});
