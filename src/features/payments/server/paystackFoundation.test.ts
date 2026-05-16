import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";
import { InMemoryBookingCommandBackend } from "@/features/bookings/server/commands/inMemoryBookingCommandBackend";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import type { Database, PaymentRow } from "@/lib/database/types";
import { finalizePaidBookingWithDeps } from "./finalizePaidBooking";
import { handlePaystackWebhook } from "./handlePaystackWebhook";
import { mapPaystackVerifyData } from "./mapPaystackCharge";
import { processPaystackChargeSuccessWithDeps } from "./upsertBookingFromPaystack";
import type { PaystackChargeSuccess } from "./paystackTypes";
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
          update: (patch: Partial<PaymentRow>) => ({
            eq: (_column: string, id: string) => ({
              then: undefined,
              async single() {
                const row = paymentsById.get(id);
                if (!row) return { data: null, error: { message: "not found" } };
                const next = { ...row, ...patch };
                paymentsById.set(id, next);
                if (next.provider_ref) paymentsByRef.set(next.provider_ref, next);
                return { data: next, error: null };
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
  const reference = "pay_ref_phase3_test";
  payment.provider_ref = reference;
  backend.payments.set(payment.id, payment);

  return { bookingId: draft.bookingId, payment, reference };
}

function sampleCharge(reference: string, amountCents: number): PaystackChargeSuccess {
  return {
    reference,
    amountCents,
    providerEventId: "paystack:txn:9001",
    transactionId: 9001,
    metadata: {},
  };
}

describe("Paystack foundation", () => {
  beforeEach(() => {
    applyPaystackUnitTestEnv();
  });

  afterEach(() => {
    restorePaystackTestEnv(paystackEnvSnapshot);
    vi.restoreAllMocks();
  });

  it("initialize path leaves booking pending_payment only (command layer)", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const customerId = crypto.randomUUID();
    const { bookingId } = await seedPendingBooking(backend, customerId);

    const booking = await backend.getBooking(bookingId);
    expect(booking?.status).toBe("pending_payment");
    expect(booking?.status).not.toBe("confirmed");

    const payments = await backend.listPaymentsForBooking(bookingId);
    expect(payments).toHaveLength(1);
    expect(payments[0]?.status).toBe("pending");
  });

  it("finalizePaidBooking confirms booking once via FINALIZE_PAYMENT_SUCCESS", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const customerId = crypto.randomUUID();
    const { bookingId, payment, reference } = await seedPendingBooking(backend, customerId);
    const { client } = createPaymentStoreMock(payment);

    const charge = sampleCharge(reference, payment.amount_cents);
    const result = await finalizePaidBookingWithDeps(client, backend, {
      bookingId,
      paymentId: payment.id,
      charge,
      source: "webhook",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe("confirmed");
    expect(result.idempotent).toBe(false);

    const booking = await backend.getBooking(bookingId);
    expect(booking?.status).toBe("confirmed");
    const paid = await backend.getPayment(payment.id);
    expect(paid?.status).toBe("paid");
  });

  it("duplicate finalize is idempotent", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const customerId = crypto.randomUUID();
    const { bookingId, payment, reference } = await seedPendingBooking(backend, customerId);
    const { client } = createPaymentStoreMock(payment);
    const charge = sampleCharge(reference, payment.amount_cents);

    const first = await finalizePaidBookingWithDeps(client, backend, {
      bookingId,
      paymentId: payment.id,
      charge,
      source: "webhook",
    });
    expect(first.ok).toBe(true);

    const second = await finalizePaidBookingWithDeps(client, backend, {
      bookingId,
      paymentId: payment.id,
      charge,
      source: "webhook",
    });
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.idempotent).toBe(true);
      expect(second.paymentEvent).toBe("duplicate");
    }
  });

  it("verify fallback uses same finalize path", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const customerId = crypto.randomUUID();
    const { bookingId, payment, reference } = await seedPendingBooking(backend, customerId);
    const { client } = createPaymentStoreMock(payment);

    const charge = sampleCharge(reference, payment.amount_cents);
    const result = await processPaystackChargeSuccessWithDeps(
      client,
      charge,
      "verify",
      backend,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe("confirmed");
      expect(await backend.getBooking(bookingId)).toMatchObject({ status: "confirmed" });
    }
  });

  it("unpaid verify mapping does not confirm booking", () => {
    const mapped = mapPaystackVerifyData({
      id: 1,
      status: "failed",
      reference: "ref_fail",
      amount: 1000,
    });
    expect(mapped).toBeNull();
  });

  it("rejects amount mismatch", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const customerId = crypto.randomUUID();
    const { bookingId, payment, reference } = await seedPendingBooking(backend, customerId);
    const { client } = createPaymentStoreMock(payment);

    const result = await finalizePaidBookingWithDeps(client, backend, {
      bookingId,
      paymentId: payment.id,
      charge: sampleCharge(reference, payment.amount_cents + 1),
      source: "webhook",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AMOUNT_MISMATCH");
    }
    expect((await backend.getBooking(bookingId))?.status).toBe("pending_payment");
  });

  it("webhook rejects bad signature", async () => {
    const body = JSON.stringify({
      event: "charge.success",
      data: { id: 1, status: "success", reference: "x", amount: 100 },
    });
    const result = await handlePaystackWebhook(body, "invalid");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INVALID_SIGNATURE");
    }
  });

  it("webhook charge.success confirms via shared handler", async () => {
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
    const signature = createHmac("sha512", PAYSTACK_UNIT_TEST_SECRET)
      .update(body)
      .digest("hex");

    const result = await handlePaystackWebhook(body, signature);
    expect(result.ok).toBe(true);
    if (result.ok && result.handled) {
      expect(result.status).toBe("confirmed");
      expect(result.bookingId).toBe(bookingId);
    }
    expect((await backend.getBooking(bookingId))?.status).toBe("confirmed");
  });
});
