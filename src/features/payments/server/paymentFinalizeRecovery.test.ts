import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { InMemoryBookingCommandBackend } from "@/features/bookings/server/commands/inMemoryBookingCommandBackend";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import type { Database, PaymentRow } from "@/lib/database/types";
import { finalizePaidBookingWithDeps } from "./finalizePaidBooking";
import {
  isPaidPaymentStatus,
  isPostPaymentBookingStatus,
  isRecoverableFinalizeCommandFailure,
  tryRecoverAlreadyFinalizedPayment,
} from "./paymentFinalizeRecovery";
import { processPaystackChargeSuccessWithDeps } from "./upsertBookingFromPaystack";
import type { PaystackChargeSuccess } from "./paystackTypes";
import {
  applyPaystackUnitTestEnv,
  restorePaystackTestEnv,
  snapshotPaystackTestEnv,
} from "@/test/paystackTestEnv";

const paystackEnvSnapshot = snapshotPaystackTestEnv();

function createPaymentStoreMock(initial: PaymentRow) {
  const paymentsById = new Map<string, PaymentRow>([[initial.id, initial]]);
  const paymentsByRef = new Map<string, PaymentRow>();
  if (initial.provider_ref) {
    paymentsByRef.set(initial.provider_ref, initial);
  }
  const eventIds = new Set<string>();

  const client = {
    from(table: string) {
      if (table === "payments") {
        return {
          select: () => ({
            eq: (column: string, value: string) => ({
              maybeSingle: async () => {
                if (column === "provider_ref") {
                  return { data: paymentsByRef.get(value) ?? null, error: null };
                }
                return { data: paymentsById.get(value) ?? null, error: null };
              },
            }),
          }),
        };
      }
      if (table === "payment_events") {
        return {
          insert: async (row: { provider_event_id: string }) => {
            if (eventIds.has(row.provider_event_id)) {
              return { error: { code: "23505", message: "duplicate" } };
            }
            eventIds.add(row.provider_event_id);
            return { error: null };
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };

  return { client: client as unknown as SupabaseClient<Database>, eventIds };
}

async function seedPendingBooking(
  backend: InMemoryBookingCommandBackend,
  customerId: string,
): Promise<{ bookingId: string; payment: PaymentRow; reference: string }> {
  const draft = await executeBookingCommand(
    backend,
    {
      type: "CREATE_BOOKING_DRAFT",
      actor: { actorType: "system", profileId: null },
      customerId,
      scheduledStart: new Date().toISOString(),
      scheduledEnd: new Date(Date.now() + 3_600_000).toISOString(),
      priceCents: 25_000,
    },
    {},
  );
  expect(draft.ok).toBe(true);
  if (!draft.ok) throw new Error("draft failed");

  const pending = await executeBookingCommand(
    backend,
    {
      type: "MARK_PAYMENT_PENDING",
      actor: { actorType: "customer", profileId: null },
      bookingId: draft.bookingId,
      paymentIdempotencyKey: `paystack:booking:${draft.bookingId}`,
      provider: "paystack",
    },
    { actingCustomerId: customerId },
  );
  expect(pending.ok).toBe(true);

  const payment = [...backend.payments.values()][0]!;
  const reference = "pay_ref_recovery_test";
  payment.provider_ref = reference;
  backend.payments.set(payment.id, payment);

  return { bookingId: draft.bookingId, payment, reference };
}

function sampleCharge(reference: string, amountCents: number): PaystackChargeSuccess {
  return {
    reference,
    amountCents,
    providerEventId: "paystack:txn:recovery9001",
    transactionId: 9001,
    metadata: {},
  };
}

class PaymentNotFinalizableBackend extends InMemoryBookingCommandBackend {
  override async finalizePaymentSuccess(): Promise<never> {
    throw new Error("PAYMENT_NOT_FINALIZABLE");
  }
}

describe("paymentFinalizeRecovery", () => {
  beforeEach(() => {
    applyPaystackUnitTestEnv();
  });

  afterEach(() => {
    restorePaystackTestEnv(paystackEnvSnapshot);
    vi.restoreAllMocks();
  });

  it("classifies recoverable finalize failures", () => {
    expect(
      isRecoverableFinalizeCommandFailure({
        ok: false,
        code: "PERSISTENCE_ERROR",
        message: "Payment finalization failed.",
      }),
    ).toBe(true);
    expect(
      isRecoverableFinalizeCommandFailure({
        ok: false,
        code: "INVALID_TRANSITION",
        message: 'Command "FINALIZE_PAYMENT_SUCCESS" is not valid from "confirmed".',
      }),
    ).toBe(true);
    expect(
      isRecoverableFinalizeCommandFailure({
        ok: false,
        code: "BOOKING_NOT_FOUND",
        message: "nope",
      }),
    ).toBe(false);
  });

  it("recognizes paid payment and post-payment booking statuses", () => {
    expect(isPaidPaymentStatus("paid")).toBe(true);
    expect(isPaidPaymentStatus("pending")).toBe(false);
    expect(isPostPaymentBookingStatus("confirmed")).toBe(true);
    expect(isPostPaymentBookingStatus("pending_assignment")).toBe(true);
    expect(isPostPaymentBookingStatus("pending_payment")).toBe(false);
    expect(isPostPaymentBookingStatus("payment_failed")).toBe(false);
  });

  it("tryRecoverAlreadyFinalizedPayment succeeds when paid and confirmed", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const customerId = crypto.randomUUID();
    const { bookingId, payment } = await seedPendingBooking(backend, customerId);
    const { client } = createPaymentStoreMock(payment);

    const charge = sampleCharge(payment.provider_ref!, payment.amount_cents);
    const first = await finalizePaidBookingWithDeps(client, backend, {
      bookingId,
      paymentId: payment.id,
      charge,
      source: "webhook",
    });
    expect(first.ok).toBe(true);

    backend.audits = [];

    const recovered = await tryRecoverAlreadyFinalizedPayment(
      client,
      backend,
      bookingId,
      payment.id,
    );
    expect(recovered).toMatchObject({
      ok: true,
      bookingId,
      status: "confirmed",
      idempotent: true,
      recoveredFromAlreadyFinalized: true,
    });
  });

  it("does not recover when payment is unpaid", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const customerId = crypto.randomUUID();
    const { bookingId, payment } = await seedPendingBooking(backend, customerId);
    const { client } = createPaymentStoreMock(payment);

    const recovered = await tryRecoverAlreadyFinalizedPayment(
      client,
      backend,
      bookingId,
      payment.id,
    );
    expect(recovered).toBeNull();
  });

  it("does not recover PAYMENT_NOT_FINALIZABLE when booking is still pending_payment", async () => {
    const backend = new PaymentNotFinalizableBackend();
    const customerId = crypto.randomUUID();
    const { bookingId, payment } = await seedPendingBooking(backend, customerId);
    payment.status = "paid";
    backend.payments.set(payment.id, payment);
    const { client } = createPaymentStoreMock(payment);

    const charge = sampleCharge(payment.provider_ref!, payment.amount_cents);
    const result = await finalizePaidBookingWithDeps(client, backend, {
      bookingId,
      paymentId: payment.id,
      charge,
      source: "verify",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PERSISTENCE_ERROR");
    }
    expect((await backend.getBooking(bookingId))?.status).toBe("pending_payment");
  });

  it("webhook finalizes first, verify path recovers on already-finalized race", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const customerId = crypto.randomUUID();
    const { bookingId, payment, reference } = await seedPendingBooking(backend, customerId);
    const { client } = createPaymentStoreMock(payment);
    const charge = sampleCharge(reference, payment.amount_cents);

    const webhook = await finalizePaidBookingWithDeps(client, backend, {
      bookingId,
      paymentId: payment.id,
      charge,
      source: "webhook",
    });
    expect(webhook.ok).toBe(true);

    backend.audits = [];

    const verify = await processPaystackChargeSuccessWithDeps(
      client,
      charge,
      "verify",
      backend,
    );

    expect(verify.ok).toBe(true);
    if (verify.ok) {
      expect(verify.idempotent).toBe(true);
      expect(verify.recoveredFromAlreadyFinalized).toBe(true);
      expect(verify.status).toBe("confirmed");
    }
  });

  it("verify finalizes first, webhook duplicate remains idempotent", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const customerId = crypto.randomUUID();
    const { bookingId, payment, reference } = await seedPendingBooking(backend, customerId);
    const { client } = createPaymentStoreMock(payment);
    const charge = sampleCharge(reference, payment.amount_cents);

    const verify = await processPaystackChargeSuccessWithDeps(
      client,
      charge,
      "verify",
      backend,
    );
    expect(verify.ok).toBe(true);
    if (verify.ok) {
      expect(verify.recoveredFromAlreadyFinalized).toBeUndefined();
    }

    const webhook = await finalizePaidBookingWithDeps(client, backend, {
      bookingId,
      paymentId: payment.id,
      charge,
      source: "webhook",
    });

    expect(webhook.ok).toBe(true);
    if (webhook.ok) {
      expect(webhook.idempotent).toBe(true);
    }
  });

  it("recovers BOOKING_NOT_AWAITING_PAYMENT equivalent when booking is post-payment", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const customerId = crypto.randomUUID();
    const { bookingId, payment, reference } = await seedPendingBooking(backend, customerId);
    const { client } = createPaymentStoreMock(payment);
    const charge = sampleCharge(reference, payment.amount_cents);

    await finalizePaidBookingWithDeps(client, backend, {
      bookingId,
      paymentId: payment.id,
      charge,
      source: "webhook",
    });

    backend.audits = [];

    const second = await finalizePaidBookingWithDeps(client, backend, {
      bookingId,
      paymentId: payment.id,
      charge,
      source: "verify",
    });

    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.recoveredFromAlreadyFinalized).toBe(true);
      expect(second.idempotent).toBe(true);
    }
  });

  it("amount mismatch still fails and does not recover", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const customerId = crypto.randomUUID();
    const { bookingId, payment, reference } = await seedPendingBooking(backend, customerId);
    const { client } = createPaymentStoreMock(payment);

    await finalizePaidBookingWithDeps(client, backend, {
      bookingId,
      paymentId: payment.id,
      charge: sampleCharge(reference, payment.amount_cents),
      source: "webhook",
    });

    backend.audits = [];

    const mismatch = await finalizePaidBookingWithDeps(client, backend, {
      bookingId,
      paymentId: payment.id,
      charge: sampleCharge(reference, payment.amount_cents + 100),
      source: "verify",
    });

    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) {
      expect(mismatch.code).toBe("AMOUNT_MISMATCH");
    }
  });
});
