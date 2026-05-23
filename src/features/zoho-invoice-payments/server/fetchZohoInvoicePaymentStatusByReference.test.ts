import { describe, expect, it, vi } from "vitest";
import type { ZohoInvoicePaymentRow } from "@/lib/database/types";

const findByReferenceMock = vi.fn();

vi.mock("./zohoInvoicePaymentRepository", () => ({
  findZohoInvoicePaymentByReference: (...args: unknown[]) => findByReferenceMock(...args),
}));

import {
  fetchZohoInvoicePaymentStatusByReference,
  publicMessageForZohoInvoicePaymentStatus,
  validatePaystackReferenceForStatusLookup,
} from "./fetchZohoInvoicePaymentStatusByReference";

function sampleRow(overrides: Partial<ZohoInvoicePaymentRow> = {}): ZohoInvoicePaymentRow {
  return {
    id: "pay-1",
    invoice_number: "INV-001602",
    zoho_invoice_id: "zoho-inv-1",
    customer_name: "Jane",
    customer_email: "jane@example.com",
    amount_cents: 10_000,
    currency: "ZAR",
    paystack_reference: "zi_INV_001602_ab12cd34",
    paystack_access_code: null,
    paystack_authorization_url: null,
    paystack_status: "success",
    zoho_payment_id: "zoho-payment-1",
    zoho_status: "success",
    status: "paid",
    idempotency_key: "key-1",
    metadata: { internal: true },
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    paid_at: "2026-01-02T00:00:00.000Z",
    reconcile_attempts: 0,
    last_reconcile_attempt_at: null,
    next_reconcile_attempt_at: null,
    last_reconcile_error: null,
    ...overrides,
  };
}

describe("fetchZohoInvoicePaymentStatusByReference", () => {
  it("rejects invalid references", async () => {
    expect(validatePaystackReferenceForStatusLookup("bad ref!")).toBe(false);
    const result = await fetchZohoInvoicePaymentStatusByReference("bad ref!");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INVALID_REFERENCE");
    }
  });

  it("returns safe status by reference without metadata", async () => {
    findByReferenceMock.mockResolvedValue(sampleRow());
    const result = await fetchZohoInvoicePaymentStatusByReference("zi_INV_001602_ab12cd34");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe("paid");
      expect(result.message).toBe(publicMessageForZohoInvoicePaymentStatus("paid"));
      expect(result.invoiceNumber).toBe("INV-001602");
      expect(result).not.toHaveProperty("metadata");
    }
  });

  it("returns save method message when authorization was saved", async () => {
    findByReferenceMock.mockResolvedValue(
      sampleRow({
        metadata: { authorization_capture_outcome: "saved" },
      }),
    );
    const result = await fetchZohoInvoicePaymentStatusByReference("zi_INV_001602_ab12cd34");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.saveMethodMessage).toBe(
        "Your payment method was saved for future approved Shalean invoices.",
      );
    }
  });

  it("returns not reusable save method message", async () => {
    findByReferenceMock.mockResolvedValue(
      sampleRow({
        metadata: { authorization_capture_outcome: "not_reusable" },
      }),
    );
    const result = await fetchZohoInvoicePaymentStatusByReference("zi_INV_001602_ab12cd34");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.saveMethodMessage).toBe(
        "Payment successful. This card could not be saved for future use.",
      );
    }
  });

  it("returns not found for unknown reference", async () => {
    findByReferenceMock.mockResolvedValue(null);
    const result = await fetchZohoInvoicePaymentStatusByReference("zi_missing_ref");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("NOT_FOUND");
    }
  });
});
