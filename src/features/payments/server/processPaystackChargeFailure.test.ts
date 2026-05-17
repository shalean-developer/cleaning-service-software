import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";
import { InMemoryBookingCommandBackend } from "@/features/bookings/server/commands/inMemoryBookingCommandBackend";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import { PAYSTACK_DECLINED_FAILURE_REASON } from "@/features/bookings/server/paymentFailureDisplay";
import type { Database, PaymentRow } from "@/lib/database/types";
import { finalizePaidBookingWithDeps } from "./finalizePaidBooking";
import { handlePaystackWebhook } from "./handlePaystackWebhook";
import { mapPaystackFailedWebhookData } from "./mapPaystackCharge";
import { processPaystackChargeFailureWithDeps } from "./processPaystackChargeFailure";
import type { PaystackChargeFailure, PaystackChargeSuccess } from "./paystackTypes";
import {
  applyPaystackUnitTestEnv,
  PAYSTACK_UNIT_TEST_SECRET,
  restorePaystackTestEnv,
  snapshotPaystackTestEnv,
} from "@/test/paystackTestEnv";

const requireServiceRoleClientMock = vi.fn();

vi.mock("@/lib/supabase/serviceRole", () => ({
  requireServiceRoleClient: () => requireServiceRoleClientMock(),
  createServiceRoleClient: () => requireServiceRoleClientMock(),
}));

const paystackEnvSnapshot = snapshotPaystackTestEnv();

function createPaymentStoreMock(initial: PaymentRow) {
  const paymentsByRef = new Map<string, PaymentRow>([
    [initial.provider_ref!, initial],
  ]);
  const paymentsById = new Map<string, PaymentRow>([[initial.id, initial]]);
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
                if (column === "id") {
                  return { data: paymentsById.get(value) ?? null, error: null };
                }
                return { data: null, error: null };
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

  return {
    client: client as unknown as SupabaseClient<Database>,
    eventIds,
  };
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
  const reference = "pay_ref_failed_test";
  payment.provider_ref = reference;
  backend.payments.set(payment.id, payment);

  return { bookingId: draft.bookingId, payment, reference };
}

function sampleFailure(
  reference: string,
  amountCents: number,
  transactionId = 9101,
  metadata: Record<string, unknown> = {},
): PaystackChargeFailure {
  return {
    reference,
    amountCents,
    providerEventId: `paystack:txn:${transactionId}`,
    transactionId,
    paystackStatus: "failed",
    gatewayResponse: "Declined",
    metadata,
  };
}

function sampleSuccessCharge(reference: string, amountCents: number): PaystackChargeSuccess {
  return {
    reference,
    amountCents,
    providerEventId: "paystack:txn:9001",
    transactionId: 9001,
    metadata: {},
  };
}

function signWebhookBody(body: string): string {
  return createHmac("sha512", PAYSTACK_UNIT_TEST_SECRET).update(body).digest("hex");
}

describe("processPaystackChargeFailure", () => {
  beforeEach(() => {
    applyPaystackUnitTestEnv();
  });

  afterEach(() => {
    restorePaystackTestEnv(paystackEnvSnapshot);
    vi.restoreAllMocks();
  });

  it("marks pending_payment booking as payment_failed via MARK_PAYMENT_FAILED", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const customerId = crypto.randomUUID();
    const { bookingId, payment, reference } = await seedPendingBooking(backend, customerId);
    const { client } = createPaymentStoreMock(payment);

    const charge = sampleFailure(reference, payment.amount_cents, 9101, {
      booking_id: bookingId,
      payment_id: payment.id,
    });
    const result = await processPaystackChargeFailureWithDeps(client, charge, backend);

    expect(result.ok).toBe(true);
    if (!result.ok || !result.handled) return;
    expect(result.status).toBe("payment_failed");
    expect(result.idempotent).toBe(false);
    expect(backend.bookings.get(bookingId)?.status).toBe("payment_failed");
    expect(backend.payments.get(payment.id)?.status).toBe("failed");

    const audit = backend.audits.find(
      (a) => a.idempotency_key === "paystack:failed:9101",
    );
    expect(audit?.metadata).toMatchObject({
      failure_reason: PAYSTACK_DECLINED_FAILURE_REASON,
      source: "paystack_webhook",
    });
  });

  it("duplicate charge.failed is idempotent", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const customerId = crypto.randomUUID();
    const { bookingId, payment, reference } = await seedPendingBooking(backend, customerId);
    const { client } = createPaymentStoreMock(payment);
    const charge = sampleFailure(reference, payment.amount_cents);

    const first = await processPaystackChargeFailureWithDeps(client, charge, backend);
    expect(first.ok).toBe(true);

    const second = await processPaystackChargeFailureWithDeps(client, charge, backend);
    expect(second.ok).toBe(true);
    if (second.ok && second.handled) {
      expect(second.idempotent).toBe(true);
      expect(second.status).toBe("payment_failed");
    }
    expect(backend.audits.filter((a) => a.command === "MARK_PAYMENT_FAILED")).toHaveLength(1);
    expect(backend.bookings.get(bookingId)?.status).toBe("payment_failed");
  });

  it("unknown reference is ignored safely", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const { client } = createPaymentStoreMock({
      id: crypto.randomUUID(),
      booking_id: crypto.randomUUID(),
      status: "pending",
      provider: "paystack",
      provider_ref: "known_ref",
      idempotency_key: "key",
      amount_cents: 1000,
      currency: "ZAR",
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      payment_link_expires_at: null,
    });

    const result = await processPaystackChargeFailureWithDeps(
      client,
      sampleFailure("unknown_ref", 1000),
      backend,
    );

    expect(result).toEqual({
      ok: true,
      handled: false,
      reason: "payment_not_found",
    });
  });

  it("skips already paid payment", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const customerId = crypto.randomUUID();
    const { bookingId, payment, reference } = await seedPendingBooking(backend, customerId);
    const { client } = createPaymentStoreMock(payment);

    payment.status = "paid";
    backend.payments.set(payment.id, payment);
    const booking = backend.bookings.get(bookingId)!;
    booking.status = "confirmed";
    backend.bookings.set(bookingId, booking);

    const result = await processPaystackChargeFailureWithDeps(
      client,
      sampleFailure(reference, payment.amount_cents),
      backend,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.handled).toBe(false);
      if (!result.handled) {
        expect(result.reason).toBe("skipped:already_paid");
      }
    }
    expect(backend.bookings.get(bookingId)?.status).toBe("confirmed");
  });

  it("skips confirmed post-payment booking even when payment row is pending", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const customerId = crypto.randomUUID();
    const { bookingId, payment, reference } = await seedPendingBooking(backend, customerId);
    const { client } = createPaymentStoreMock(payment);

    const booking = backend.bookings.get(bookingId)!;
    booking.status = "pending_assignment";
    backend.bookings.set(bookingId, booking);

    const result = await processPaystackChargeFailureWithDeps(
      client,
      sampleFailure(reference, payment.amount_cents),
      backend,
    );

    expect(result.ok).toBe(true);
    if (result.ok && !result.handled) {
      expect(result.reason).toBe("skipped:already_paid");
    }
    expect(backend.bookings.get(bookingId)?.status).toBe("pending_assignment");
  });

  it("failed-after-success does not downgrade booking", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const customerId = crypto.randomUUID();
    const { bookingId, payment, reference } = await seedPendingBooking(backend, customerId);
    const { client } = createPaymentStoreMock(payment);

    const finalized = await finalizePaidBookingWithDeps(client, backend, {
      bookingId,
      paymentId: payment.id,
      charge: sampleSuccessCharge(reference, payment.amount_cents),
      source: "webhook",
    });
    expect(finalized.ok).toBe(true);

    const failure = await processPaystackChargeFailureWithDeps(
      client,
      sampleFailure(reference, payment.amount_cents, 9199),
      backend,
    );

    expect(failure.ok).toBe(true);
    if (failure.ok && !failure.handled) {
      expect(failure.reason).toBe("skipped:already_paid");
    }
    expect(backend.bookings.get(bookingId)?.status).toBe("confirmed");
    expect(backend.payments.get(payment.id)?.status).toBe("paid");
  });

  it("already payment_failed booking returns ok idempotent", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const customerId = crypto.randomUUID();
    const { bookingId, payment, reference } = await seedPendingBooking(backend, customerId);
    const { client } = createPaymentStoreMock(payment);

    await executeBookingCommand(
      backend,
      {
        type: "MARK_PAYMENT_FAILED",
        actor: { actorType: "service", profileId: null },
        bookingId,
        paymentId: payment.id,
        idempotencyKey: "cron:expire",
        reason: "test",
        metadata: { failure_reason: "checkout_expired" },
      },
      {},
    );

    const result = await processPaystackChargeFailureWithDeps(
      client,
      sampleFailure(reference, payment.amount_cents, 9200),
      backend,
    );

    expect(result.ok).toBe(true);
    if (result.ok && result.handled) {
      expect(result.idempotent).toBe(true);
      expect(result.status).toBe("payment_failed");
    }
    expect(backend.audits.filter((a) => a.command === "MARK_PAYMENT_FAILED")).toHaveLength(1);
  });

  it("mapPaystackFailedWebhookData rejects success status", () => {
    expect(
      mapPaystackFailedWebhookData({
        id: 1,
        status: "success",
        reference: "ref",
        amount: 100,
      }),
    ).toBeNull();
  });
});

describe("handlePaystackWebhook charge.failed", () => {
  beforeEach(() => {
    applyPaystackUnitTestEnv();
  });

  afterEach(() => {
    restorePaystackTestEnv(paystackEnvSnapshot);
    vi.restoreAllMocks();
  });

  it("webhook charge.failed marks booking payment_failed", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const customerId = crypto.randomUUID();
    const { bookingId, payment, reference } = await seedPendingBooking(backend, customerId);
    const { client } = createPaymentStoreMock(payment);
    requireServiceRoleClientMock.mockReturnValue(client);
    vi.stubEnv("BOOKING_COMMAND_BACKEND", "memory");

    const failureModule = await import("./processPaystackChargeFailure");
    vi.spyOn(failureModule, "processPaystackChargeFailure").mockImplementation((charge) =>
      failureModule.processPaystackChargeFailureWithDeps(client, charge, backend),
    );

    const body = JSON.stringify({
      event: "charge.failed",
      data: {
        id: 9101,
        status: "failed",
        reference,
        amount: payment.amount_cents,
        gateway_response: "Declined",
        metadata: { booking_id: bookingId, payment_id: payment.id },
      },
    });

    const result = await handlePaystackWebhook(body, signWebhookBody(body));
    expect(result.ok).toBe(true);
    if (result.ok && result.handled) {
      expect(result.status).toBe("payment_failed");
      expect(result.bookingId).toBe(bookingId);
    }
    expect(backend.bookings.get(bookingId)?.status).toBe("payment_failed");
  });

  it("webhook charge.success behavior unchanged", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const customerId = crypto.randomUUID();
    const { bookingId, payment, reference } = await seedPendingBooking(backend, customerId);
    const { client } = createPaymentStoreMock(payment);
    requireServiceRoleClientMock.mockReturnValue(client);
    vi.stubEnv("BOOKING_COMMAND_BACKEND", "memory");

    const upsertModule = await import("./upsertBookingFromPaystack");
    vi.spyOn(upsertModule, "processPaystackChargeSuccess").mockImplementation((charge, source) =>
      upsertModule.processPaystackChargeSuccessWithDeps(client, charge, source, backend),
    );

    const body = JSON.stringify({
      event: "charge.success",
      data: {
        id: 9001,
        status: "success",
        reference,
        amount: payment.amount_cents,
      },
    });

    const result = await handlePaystackWebhook(body, signWebhookBody(body));
    expect(result.ok).toBe(true);
    if (result.ok && result.handled) {
      expect(result.status).toBe("confirmed");
    }
    expect(backend.bookings.get(bookingId)?.status).toBe("confirmed");
  });

  it("unsupported webhook events remain ignored", async () => {
    const body = JSON.stringify({
      event: "transfer.success",
      data: { id: 1, status: "success", reference: "x", amount: 100 },
    });
    const result = await handlePaystackWebhook(body, signWebhookBody(body));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.handled).toBe(false);
      if (!result.handled) {
        expect(result.reason).toBe("ignored:transfer.success");
      }
    }
  });
});
