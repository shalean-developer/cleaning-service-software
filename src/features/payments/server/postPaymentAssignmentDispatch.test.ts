import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { InMemoryBookingCommandBackend } from "@/features/bookings/server/commands/inMemoryBookingCommandBackend";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import type { Database, PaymentRow } from "@/lib/database/types";
import { readAssignmentMetadata } from "@/features/assignments/server/assignmentMetadata";
import { DISPATCH_NOT_STARTED_REASON } from "@/features/assignments/server/isAssignmentRecoveryCandidate";
import { runPostPaymentAssignmentDispatch } from "./postPaymentAssignmentDispatch";

const assignmentMock = vi.hoisted(() => ({
  runAssignmentAfterPayment: vi.fn(),
}));

vi.mock("@/features/assignments/server/runAssignmentAfterPayment", () => ({
  runAssignmentAfterPayment: assignmentMock.runAssignmentAfterPayment,
}));

const systemActor = { actorType: "system" as const, profileId: null };

async function seedConfirmedBooking(
  backend: InMemoryBookingCommandBackend,
  scheduledStart: string,
): Promise<string> {
  const draft = await executeBookingCommand(
    backend,
    {
      type: "CREATE_BOOKING_DRAFT",
      actor: systemActor,
      customerId: "cust-deferred",
      scheduledStart,
      scheduledEnd: new Date(Date.parse(scheduledStart) + 3_600_000).toISOString(),
      priceCents: 25_000,
    },
    {},
  );
  if (!draft.ok) throw new Error("draft");
  await executeBookingCommand(
    backend,
    {
      type: "MARK_PAYMENT_PENDING",
      actor: systemActor,
      bookingId: draft.bookingId,
      paymentIdempotencyKey: `pay-${draft.bookingId}`,
    },
    {},
  );
  const payment = [...backend.payments.values()][0]!;
  await executeBookingCommand(
    backend,
    {
      type: "FINALIZE_PAYMENT_SUCCESS",
      actor: systemActor,
      bookingId: draft.bookingId,
      paymentId: payment.id,
      idempotencyKey: `finalize-${draft.bookingId}`,
    },
    {},
  );
  return draft.bookingId;
}

describe("runPostPaymentAssignmentDispatch", () => {
  beforeEach(() => {
    assignmentMock.runAssignmentAfterPayment.mockReset();
    assignmentMock.runAssignmentAfterPayment.mockResolvedValue({
      ok: true,
      bookingId: "x",
      bookingStatus: "pending_assignment",
      outcome: "offered",
      offerId: "offer-1",
      cleanerId: "cleaner-1",
      idempotent: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("runs assignment immediately when deferred flag is disabled", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const farFuture = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    const bookingId = await seedConfirmedBooking(backend, farFuture);
    const booking = (await backend.getBooking(bookingId))!;
    const client = {} as SupabaseClient<Database>;

    const result = await runPostPaymentAssignmentDispatch(
      client,
      backend,
      booking,
      {
        bookingId,
        paymentId: [...backend.payments.values()][0]!.id,
        customerId: booking.customer_id,
        charge: {
          reference: "ref",
          transactionId: 1,
          amountCents: 25_000,
          providerEventId: "evt",
          metadata: {},
        },
      },
      { config: { enabled: false, dispatchLeadDays: 14 } },
    );

    expect(result.action).toBe("skipped_immediate");
    expect(assignmentMock.runAssignmentAfterPayment).toHaveBeenCalledOnce();
    expect(booking.assignment_dispatch_at).toBeTruthy();
  });

  it("defers far-future booking when flag enabled", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const farFuture = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    const bookingId = await seedConfirmedBooking(backend, farFuture);
    const booking = (await backend.getBooking(bookingId))!;
    const client = {} as SupabaseClient<Database>;
    const now = new Date();

    const result = await runPostPaymentAssignmentDispatch(
      client,
      backend,
      booking,
      {
        bookingId,
        paymentId: [...backend.payments.values()][0]!.id,
        customerId: booking.customer_id,
        charge: {
          reference: "ref-defer",
          transactionId: 2,
          amountCents: 25_000,
          providerEventId: "evt-defer",
          metadata: {},
        },
      },
      { config: { enabled: true, dispatchLeadDays: 14 }, now },
    );

    expect(result.action).toBe("deferred");
    expect(assignmentMock.runAssignmentAfterPayment).not.toHaveBeenCalled();
    const updated = await backend.getBooking(bookingId);
    expect(updated?.status).toBe("confirmed");
    expect(updated?.assignment_dispatch_at).toBeTruthy();
    const meta = readAssignmentMetadata(updated?.metadata);
    expect(meta?.status).toBe("deferred");
    expect(meta?.reason).not.toContain(DISPATCH_NOT_STARTED_REASON);
  });

  it("dispatches near-term booking immediately when flag enabled", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const bookingId = await seedConfirmedBooking(backend, soon);
    const booking = (await backend.getBooking(bookingId))!;
    const client = {} as SupabaseClient<Database>;

    const result = await runPostPaymentAssignmentDispatch(
      client,
      backend,
      booking,
      {
        bookingId,
        paymentId: [...backend.payments.values()][0]!.id,
        customerId: booking.customer_id,
        charge: {
          reference: "ref-soon",
          transactionId: 3,
          amountCents: 25_000,
          providerEventId: "evt-soon",
          metadata: {},
        },
      },
      { config: { enabled: true, dispatchLeadDays: 14 } },
    );

    expect(result.action).toBe("ran");
    expect(assignmentMock.runAssignmentAfterPayment).toHaveBeenCalledOnce();
  });
});
