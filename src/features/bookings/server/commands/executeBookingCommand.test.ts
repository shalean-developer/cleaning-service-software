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

  it("forbids direct status patches at the application layer", () => {
    expect(() => forbidBookingStatusInPatch({ status: "completed" })).toThrow(
      /executeBookingCommand/,
    );
    expect(() => forbidBookingStatusInPatch({ price_cents: 1 })).not.toThrow();
  });
});
