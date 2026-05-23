import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";
import { InMemoryBookingCommandBackend } from "@/features/bookings/server/commands/inMemoryBookingCommandBackend";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import type { Database, PaymentRow, ZohoInvoicePaymentRow } from "@/lib/database/types";
import { handlePaystackWebhook } from "./handlePaystackWebhook";
import { routePaystackWebhookEvent } from "./routePaystackWebhookEvent";
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

function createCombinedStoreMock(initial: {
  payment?: PaymentRow;
  zohoPayment?: ZohoInvoicePaymentRow;
}) {
  const paymentsByRef = new Map<string, PaymentRow>();
  const paymentsById = new Map<string, PaymentRow>();
  const paymentEventIds = new Set<string>();

  if (initial.payment?.provider_ref) {
    paymentsByRef.set(initial.payment.provider_ref, initial.payment);
    paymentsById.set(initial.payment.id, initial.payment);
  }

  let zohoPayment = initial.zohoPayment ?? null;
  const zohoEventIds = new Set<string>();

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
            if (paymentEventIds.has(row.provider_event_id)) {
              return { error: { code: "23505", message: "duplicate" } };
            }
            paymentEventIds.add(row.provider_event_id);
            return { error: null };
          },
        };
      }

      if (table === "zoho_invoice_payments") {
        return {
          select: () => ({
            eq: (_column: string, value: string) => ({
              maybeSingle: async () => {
                if (!zohoPayment) return { data: null, error: null };
                if (_column === "paystack_reference" && zohoPayment.paystack_reference === value) {
                  return { data: zohoPayment, error: null };
                }
                if (_column === "id" && zohoPayment.id === value) {
                  return { data: zohoPayment, error: null };
                }
                return { data: null, error: null };
              },
            }),
          }),
          update: (patch: Partial<ZohoInvoicePaymentRow>) => ({
            eq: (_column: string, id: string) => ({
              select: () => ({
                single: async () => {
                  if (!zohoPayment || zohoPayment.id !== id) {
                    return { data: null, error: { message: "not found" } };
                  }
                  zohoPayment = { ...zohoPayment, ...patch, id };
                  return { data: zohoPayment, error: null };
                },
              }),
            }),
          }),
        };
      }

      if (table === "zoho_invoice_payment_events") {
        return {
          insert: async (row: { provider_event_id: string }) => {
            if (zohoEventIds.has(row.provider_event_id)) {
              return { error: { code: "23505", message: "duplicate" } };
            }
            zohoEventIds.add(row.provider_event_id);
            return { error: null };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };

  return {
    client: client as unknown as SupabaseClient<Database>,
    getZohoPayment: () => zohoPayment,
    zohoEventIds,
  };
}

async function seedPendingBooking(
  backend: InMemoryBookingCommandBackend,
  customerId: string,
  reference: string,
) {
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
  payment.provider_ref = reference;
  backend.payments.set(payment.id, payment);

  return { bookingId: draft.bookingId, payment };
}

function sampleZohoPayment(
  overrides: Partial<ZohoInvoicePaymentRow> = {},
): ZohoInvoicePaymentRow {
  return {
    id: "zoho-pay-1",
    invoice_number: "INV-001602",
    zoho_invoice_id: "zoho-inv-1",
    customer_name: "Jane",
    customer_email: "jane@example.com",
    amount_cents: 10_000,
    currency: "ZAR",
    paystack_reference: "zi_INV_001602_ab12cd34",
    paystack_access_code: "access",
    paystack_authorization_url: "https://checkout.paystack.com/test",
    paystack_status: "initialized",
    zoho_payment_id: null,
    zoho_status: null,
    status: "pending_paystack",
    idempotency_key: "key-1",
    metadata: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    paid_at: null,
    ...overrides,
  };
}

function signWebhookBody(body: string): string {
  return createHmac("sha512", PAYSTACK_UNIT_TEST_SECRET).update(body).digest("hex");
}

describe("routePaystackWebhookEvent", () => {
  beforeEach(() => {
    applyPaystackUnitTestEnv();
  });

  afterEach(() => {
    restorePaystackTestEnv(paystackEnvSnapshot);
    vi.restoreAllMocks();
  });

  it("routes admin_assisted metadata.source to booking success handler", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const customerId = crypto.randomUUID();
    const reference = "bk_admin_assist_ref_123";
    const { bookingId, payment } = await seedPendingBooking(backend, customerId, reference);
    const { client } = createCombinedStoreMock({ payment });
    requireServiceRoleClientMock.mockReturnValue(client);
    vi.stubEnv("BOOKING_COMMAND_BACKEND", "memory");

    const upsertModule = await import("./upsertBookingFromPaystack");
    vi.spyOn(upsertModule, "processPaystackChargeSuccess").mockImplementation((charge, source) =>
      upsertModule.processPaystackChargeSuccessWithDeps(client, charge, source, backend),
    );

    const result = await routePaystackWebhookEvent({
      event: "charge.success",
      data: {
        id: 9002,
        status: "success",
        reference,
        amount: payment.amount_cents,
        metadata: { source: "admin_assisted", booking_id: bookingId },
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.handled) {
      expect(result.source).toBe("booking");
      expect(result.bookingId).toBe(bookingId);
      expect(result.status).toBe("confirmed");
    }
    const booking = backend.bookings.get(bookingId);
    expect(booking?.status).toBe("confirmed");
  });

  it("routes booking metadata.source to booking success handler", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const customerId = crypto.randomUUID();
    const reference = "bk_booking_ref_123";
    const { bookingId, payment } = await seedPendingBooking(backend, customerId, reference);
    const { client } = createCombinedStoreMock({ payment });
    requireServiceRoleClientMock.mockReturnValue(client);
    vi.stubEnv("BOOKING_COMMAND_BACKEND", "memory");

    const upsertModule = await import("./upsertBookingFromPaystack");
    vi.spyOn(upsertModule, "processPaystackChargeSuccess").mockImplementation((charge, source) =>
      upsertModule.processPaystackChargeSuccessWithDeps(client, charge, source, backend),
    );

    const result = await routePaystackWebhookEvent({
      event: "charge.success",
      data: {
        id: 9001,
        status: "success",
        reference,
        amount: payment.amount_cents,
        metadata: { source: "booking", booking_id: bookingId },
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.handled) {
      expect(result.source).toBe("booking");
      expect(result.bookingId).toBe(bookingId);
      expect(result.status).toBe("confirmed");
    }
  });

  it("routes zoho metadata.source to Zoho success handler", async () => {
    const zohoPayment = sampleZohoPayment();
    const { client, getZohoPayment } = createCombinedStoreMock({ zohoPayment });
    requireServiceRoleClientMock.mockReturnValue(client);

    const paystackModule = await import("./paystackClient");
    vi.spyOn(paystackModule, "paystackVerifyTransaction").mockResolvedValue({
      status: true,
      message: "ok",
      data: {
        id: 9001,
        status: "success",
        reference: zohoPayment.paystack_reference!,
        amount: zohoPayment.amount_cents,
        currency: "ZAR",
      },
    });

    const zohoModule = await import("@/lib/zoho/customerPayments");
    vi.spyOn(zohoModule, "createZohoCustomerPaymentForInvoice").mockResolvedValue({
      ok: true,
      zohoPaymentId: "zoho-payment-1",
      zohoStatus: "success",
    });

    const result = await routePaystackWebhookEvent({
      event: "charge.success",
      data: {
        id: 9001,
        status: "success",
        reference: zohoPayment.paystack_reference!,
        amount: zohoPayment.amount_cents,
        metadata: {
          source: "zoho_invoice",
          zoho_invoice_payment_id: zohoPayment.id,
        },
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.handled) {
      expect(result.source).toBe("zoho_invoice");
      expect(result.invoiceNumber).toBe("INV-001602");
      expect(result.status).toBe("paid");
    }
    expect(getZohoPayment()?.status).toBe("paid");
    expect(getZohoPayment()?.zoho_payment_id).toBe("zoho-payment-1");
  });

  it("routes zia_ prefix to authorization charge handler", async () => {
    const authProcessor = await import(
      "@/features/zoho-invoice-payments/server/processZohoInvoiceAuthorizationChargeSuccess"
    );
    const spy = vi
      .spyOn(authProcessor, "processZohoInvoiceAuthorizationChargeSuccess")
      .mockResolvedValue({
        ok: true,
        handled: true,
        source: "zoho_invoice_authorization_charge",
        invoiceNumber: "INV-001602",
        status: "paid",
        idempotent: false,
      });

    await routePaystackWebhookEvent({
      event: "charge.success",
      data: {
        id: 9001,
        status: "success",
        reference: "zia_INV_001602_ab12cd34",
        amount: 10_000,
        metadata: { source: "zoho_invoice_authorization_charge" },
      },
    });

    expect(spy).toHaveBeenCalled();
  });

  it("routes zi_ prefix without metadata to Zoho handler", async () => {
    const zohoPayment = sampleZohoPayment();
    const { client } = createCombinedStoreMock({ zohoPayment });
    requireServiceRoleClientMock.mockReturnValue(client);

    const zohoProcessor = await import(
      "@/features/zoho-invoice-payments/server/processZohoInvoiceChargeSuccess"
    );
    const spy = vi.spyOn(zohoProcessor, "processZohoInvoiceChargeSuccess").mockResolvedValue({
      ok: true,
      handled: true,
      source: "zoho_invoice",
      invoiceNumber: zohoPayment.invoice_number,
      status: "paid",
      idempotent: false,
    });

    await routePaystackWebhookEvent({
      event: "charge.success",
      data: {
        id: 9001,
        status: "success",
        reference: zohoPayment.paystack_reference!,
        amount: zohoPayment.amount_cents,
      },
    });

    expect(spy).toHaveBeenCalled();
  });

  it("handlePaystackWebhook still confirms booking for legacy events", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const customerId = crypto.randomUUID();
    const reference = "legacy_ref_123";
    const { bookingId, payment } = await seedPendingBooking(backend, customerId, reference);
    const { client } = createCombinedStoreMock({ payment });
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
      expect(result.bookingId).toBe(bookingId);
      expect(result.status).toBe("confirmed");
    }
  });
});
