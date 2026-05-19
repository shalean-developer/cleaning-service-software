import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildOfferExpiresAt } from "@/features/assignments/server/buildOfferExpiry";
import { InMemoryBookingCommandBackend } from "@/features/bookings/server/commands/inMemoryBookingCommandBackend";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import { testAssignmentOfferRow } from "@/features/bookings/server/commands/testAssignmentOfferRow";
import type { Database } from "@/lib/database/types";
import {
  shouldDispatchAssignmentAfterAlreadyFinalizedRecovery,
  tryDispatchAssignmentAfterAlreadyFinalizedRecovery,
} from "./alreadyFinalizedAssignmentDispatch";
import type { PaystackChargeSuccess } from "./paystackTypes";

const dispatchMock = vi.hoisted(() => ({
  runPostPaymentAssignmentDispatch: vi.fn(),
}));

vi.mock("./postPaymentAssignmentDispatch", () => ({
  runPostPaymentAssignmentDispatch: dispatchMock.runPostPaymentAssignmentDispatch,
}));

const systemActor = { actorType: "system" as const, profileId: null };

const charge: PaystackChargeSuccess = {
  reference: "ref-recovery-dispatch",
  transactionId: 42,
  amountCents: 25_000,
  providerEventId: "evt-recovery-dispatch",
  metadata: {},
};

function createOffersClient(
  backend: InMemoryBookingCommandBackend,
): SupabaseClient<Database> {
  return {
    from(table: string) {
      if (table === "assignment_offers") {
        return {
          select: () => ({
            eq: (_col: string, val: string) => ({
              order: async () => ({
                data: [...backend.offers.values()].filter((o) => o.booking_id === val),
                error: null,
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  } as unknown as SupabaseClient<Database>;
}

async function seedPaidConfirmedBooking(
  backend: InMemoryBookingCommandBackend,
): Promise<{ bookingId: string; paymentId: string; customerId: string }> {
  const customerId = crypto.randomUUID();
  const draft = await executeBookingCommand(
    backend,
    {
      type: "CREATE_BOOKING_DRAFT",
      actor: systemActor,
      customerId,
      scheduledStart: new Date(Date.now() + 86_400_000).toISOString(),
      scheduledEnd: new Date(Date.now() + 90_000_000).toISOString(),
      priceCents: 25_000,
    },
    {},
  );
  if (!draft.ok) throw new Error("draft failed");

  await executeBookingCommand(
    backend,
    {
      type: "MARK_PAYMENT_PENDING",
      actor: systemActor,
      bookingId: draft.bookingId,
      paymentIdempotencyKey: `pay:${draft.bookingId}`,
    },
    {},
  );

  const payment = [...backend.payments.values()][0]!;
  const finalized = await executeBookingCommand(
    backend,
    {
      type: "FINALIZE_PAYMENT_SUCCESS",
      actor: systemActor,
      bookingId: draft.bookingId,
      paymentId: payment.id,
      idempotencyKey: `finalize:${draft.bookingId}`,
      reason: "test",
    },
    {},
  );
  if (!finalized.ok) throw new Error("finalize failed");

  return { bookingId: draft.bookingId, paymentId: payment.id, customerId };
}

describe("shouldDispatchAssignmentAfterAlreadyFinalizedRecovery", () => {
  it("is true for paid confirmed booking with no offers", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const { bookingId, paymentId } = await seedPaidConfirmedBooking(backend);
    const client = createOffersClient(backend);

    await expect(
      shouldDispatchAssignmentAfterAlreadyFinalizedRecovery(
        client,
        backend,
        bookingId,
        paymentId,
      ),
    ).resolves.toBe(true);
  });

  it("is false when an open offer exists", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const { bookingId, paymentId, customerId } = await seedPaidConfirmedBooking(backend);
    const booking = await backend.getBooking(bookingId);
    if (!booking) throw new Error("missing booking");

    backend.bookings.set(bookingId, { ...booking, status: "pending_assignment" });
    backend.offers.set(
      "offer-open",
      testAssignmentOfferRow({
        id: "offer-open",
        booking_id: bookingId,
        cleaner_id: crypto.randomUUID(),
        status: "offered",
        offered_at: new Date().toISOString(),
        responded_at: null,
        expires_at: buildOfferExpiresAt(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    );

    const client = createOffersClient(backend);
    await expect(
      shouldDispatchAssignmentAfterAlreadyFinalizedRecovery(
        client,
        backend,
        bookingId,
        paymentId,
      ),
    ).resolves.toBe(false);

    void customerId;
  });

  it("is false when booking is assigned", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const { bookingId, paymentId } = await seedPaidConfirmedBooking(backend);
    const booking = await backend.getBooking(bookingId);
    if (!booking) throw new Error("missing booking");

    backend.bookings.set(bookingId, {
      ...booking,
      status: "assigned",
      cleaner_id: crypto.randomUUID(),
    });

    const client = createOffersClient(backend);
    await expect(
      shouldDispatchAssignmentAfterAlreadyFinalizedRecovery(
        client,
        backend,
        bookingId,
        paymentId,
      ),
    ).resolves.toBe(false);
  });

  it("is false when payment is not paid", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const { bookingId, paymentId } = await seedPaidConfirmedBooking(backend);
    const payment = await backend.getPayment(paymentId);
    if (!payment) throw new Error("missing payment");
    backend.payments.set(paymentId, { ...payment, status: "pending" });

    const client = createOffersClient(backend);
    await expect(
      shouldDispatchAssignmentAfterAlreadyFinalizedRecovery(
        client,
        backend,
        bookingId,
        paymentId,
      ),
    ).resolves.toBe(false);
  });

  it("is false when booking is still pending_payment", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const customerId = crypto.randomUUID();
    const draft = await executeBookingCommand(
      backend,
      {
        type: "CREATE_BOOKING_DRAFT",
        actor: systemActor,
        customerId,
        scheduledStart: new Date().toISOString(),
        scheduledEnd: new Date(Date.now() + 3_600_000).toISOString(),
        priceCents: 25_000,
      },
      {},
    );
    if (!draft.ok) throw new Error("draft failed");

    await executeBookingCommand(
      backend,
      {
        type: "MARK_PAYMENT_PENDING",
        actor: systemActor,
        bookingId: draft.bookingId,
        paymentIdempotencyKey: "pay-pending",
      },
      {},
    );
    const payment = [...backend.payments.values()][0]!;
    const client = createOffersClient(backend);

    await expect(
      shouldDispatchAssignmentAfterAlreadyFinalizedRecovery(
        client,
        backend,
        draft.bookingId,
        payment.id,
      ),
    ).resolves.toBe(false);
  });
});

describe("tryDispatchAssignmentAfterAlreadyFinalizedRecovery", () => {
  it("calls runPostPaymentAssignmentDispatch when dispatch is needed", async () => {
    dispatchMock.runPostPaymentAssignmentDispatch.mockReset();
    dispatchMock.runPostPaymentAssignmentDispatch.mockResolvedValue({
      action: "skipped_immediate",
      assignmentDispatchAt: new Date().toISOString(),
      assignmentResult: {
        ok: true,
        bookingId: "x",
        bookingStatus: "pending_assignment",
        outcome: "offered",
        offerId: null,
        cleanerId: null,
        idempotent: false,
      },
    });

    const backend = new InMemoryBookingCommandBackend();
    const { bookingId, paymentId, customerId } = await seedPaidConfirmedBooking(backend);
    const client = createOffersClient(backend);

    const result = await tryDispatchAssignmentAfterAlreadyFinalizedRecovery(
      client,
      backend,
      { bookingId, paymentId, customerId, charge },
    );

    expect(result).toEqual({ dispatched: true });
    expect(dispatchMock.runPostPaymentAssignmentDispatch).toHaveBeenCalledTimes(1);
  });

  it("does not call dispatch when an open offer already exists", async () => {
    dispatchMock.runPostPaymentAssignmentDispatch.mockReset();

    const backend = new InMemoryBookingCommandBackend();
    const { bookingId, paymentId, customerId } = await seedPaidConfirmedBooking(backend);
    const booking = await backend.getBooking(bookingId);
    if (!booking) throw new Error("missing booking");

    backend.bookings.set(bookingId, { ...booking, status: "pending_assignment" });
    backend.offers.set(
      "offer-open-2",
      testAssignmentOfferRow({
        id: "offer-open-2",
        booking_id: bookingId,
        cleaner_id: crypto.randomUUID(),
        status: "offered",
        offered_at: new Date().toISOString(),
        responded_at: null,
        expires_at: buildOfferExpiresAt(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    );

    const client = createOffersClient(backend);
    const result = await tryDispatchAssignmentAfterAlreadyFinalizedRecovery(
      client,
      backend,
      { bookingId, paymentId, customerId, charge },
    );

    expect(result).toEqual({ dispatched: false });
    expect(dispatchMock.runPostPaymentAssignmentDispatch).not.toHaveBeenCalled();
  });
});
