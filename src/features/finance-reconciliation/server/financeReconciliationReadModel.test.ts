import { describe, expect, it } from "vitest";
import type {
  PaymentRow,
  ZohoInvoiceAuthorizationChargeRow,
  ZohoInvoicePaymentRow,
  ZohoRefundCreditSyncRow,
  ZohoSalesSyncRow,
} from "@/lib/database/types";
import {
  buildBookingItems,
  buildRefundCreditItems,
  buildSavedCardItems,
  buildZohoInvoiceItems,
  computeSummary,
} from "./financeReconciliationReadModel";

function payment(overrides: Partial<PaymentRow> = {}): PaymentRow {
  return {
    id: "pay-1",
    booking_id: "booking-1",
    status: "paid",
    provider: "paystack",
    provider_ref: "pay-ref-1",
    idempotency_key: "idem-1",
    amount_cents: 5000,
    currency: "ZAR",
    payment_link_expires_at: null,
    metadata: {},
    created_at: "2026-07-01T10:00:00.000Z",
    updated_at: "2026-07-01T10:05:00.000Z",
    ...overrides,
  };
}

function salesSync(overrides: Partial<ZohoSalesSyncRow> = {}): ZohoSalesSyncRow {
  return {
    id: "sync-1",
    source_type: "booking",
    source_id: "booking-1",
    booking_id: "booking-1",
    invoice_number: "INV-001",
    zoho_invoice_id: "inv-1",
    zoho_customer_id: "cust-1",
    zoho_payment_id: "zpay-1",
    amount_cents: 5000,
    currency: "ZAR",
    sync_status: "synced",
    sync_attempts: 0,
    last_sync_attempt_at: null,
    next_sync_attempt_at: null,
    last_sync_error: null,
    metadata: {},
    created_at: "2026-07-01T10:00:00.000Z",
    updated_at: "2026-07-01T10:05:00.000Z",
    synced_at: "2026-07-01T10:05:00.000Z",
    ...overrides,
  };
}

describe("financeReconciliationReadModel mappers", () => {
  it("marks booking paid + synced Zoho as matched", () => {
    const map = new Map<string, ZohoSalesSyncRow>([["booking-1", salesSync()]]);
    const [item] = buildBookingItems([payment()], map);
    expect(item.reconciliationStatus).toBe("matched");
    expect(item.issueCode).toBe("MATCHED");
  });

  it("marks booking paid without sync row as mismatch", () => {
    const [item] = buildBookingItems([payment()], new Map());
    expect(item.reconciliationStatus).toBe("mismatch");
    expect(item.issueCode).toBe("MISSING_ZOHO_SYNC");
  });

  it("marks booking sync failed as failed", () => {
    const map = new Map<string, ZohoSalesSyncRow>([
      ["booking-1", salesSync({ sync_status: "failed" })],
    ]);
    const [item] = buildBookingItems([payment()], map);
    expect(item.reconciliationStatus).toBe("failed");
    expect(item.issueCode).toBe("ZOHO_SYNC_FAILED");
  });

  it("marks manual invoice paid with zoho_payment_id as matched", () => {
    const row: ZohoInvoicePaymentRow = {
      id: "zip-1",
      invoice_number: "INV-100",
      zoho_invoice_id: "inv-1",
      customer_name: "Jane",
      customer_email: "jane@example.com",
      amount_cents: 10000,
      currency: "ZAR",
      paystack_reference: "pay-100",
      paystack_access_code: "secret",
      paystack_authorization_url: "https://secret",
      paystack_status: "success",
      zoho_payment_id: "zpay-100",
      zoho_status: "paid",
      status: "paid",
      idempotency_key: "idem",
      metadata: {},
      created_at: "2026-07-01T10:00:00.000Z",
      updated_at: "2026-07-01T10:05:00.000Z",
      paid_at: "2026-07-01T10:05:00.000Z",
      reconcile_attempts: 0,
      last_reconcile_attempt_at: null,
      next_reconcile_attempt_at: null,
      last_reconcile_error: null,
    };
    const [item] = buildZohoInvoiceItems([row]);
    expect(item.reconciliationStatus).toBe("matched");
    expect(item.customerLabel).toBe("Jane");
    expect(JSON.stringify(item)).not.toContain("secret");
  });

  it("marks manual invoice paid without zoho_payment_id as mismatch", () => {
    const row = {
      id: "zip-2",
      invoice_number: "INV-101",
      zoho_invoice_id: "inv-2",
      customer_name: null,
      customer_email: "a@b.com",
      amount_cents: 10000,
      currency: "ZAR",
      paystack_reference: "pay-101",
      paystack_access_code: null,
      paystack_authorization_url: null,
      paystack_status: "success",
      zoho_payment_id: null,
      zoho_status: null,
      status: "paid" as const,
      idempotency_key: "idem",
      metadata: {},
      created_at: "2026-07-01T10:00:00.000Z",
      updated_at: "2026-07-01T10:05:00.000Z",
      paid_at: "2026-07-01T10:05:00.000Z",
      reconcile_attempts: 0,
      last_reconcile_attempt_at: null,
      next_reconcile_attempt_at: null,
      last_reconcile_error: null,
    } satisfies ZohoInvoicePaymentRow;
    const [item] = buildZohoInvoiceItems([row]);
    expect(item.reconciliationStatus).toBe("mismatch");
    expect(item.issueCode).toBe("MISSING_ZOHO_PAYMENT_ID");
    expect(item.customerLabel).toMatch(/\*@/);
  });

  it("marks saved-card charge paid with zoho_payment_id as matched", () => {
    const row: ZohoInvoiceAuthorizationChargeRow = {
      id: "auth-1",
      invoice_number: "INV-200",
      zoho_invoice_id: "inv-200",
      payment_method_id: "pm-1",
      customer_email: "c@d.com",
      amount_cents: 7500,
      currency: "ZAR",
      paystack_reference: "pay-200",
      paystack_status: "success",
      zoho_payment_id: "zpay-200",
      zoho_status: "paid",
      status: "paid",
      initiated_by_admin_id: "admin-1",
      reason: "Admin charge",
      metadata: {},
      reconcile_attempts: 0,
      last_reconcile_attempt_at: null,
      next_reconcile_attempt_at: null,
      last_reconcile_error: null,
      created_at: "2026-07-01T10:00:00.000Z",
      paid_at: "2026-07-01T10:05:00.000Z",
      failed_at: null,
    };
    const [item] = buildSavedCardItems([row]);
    expect(item.reconciliationStatus).toBe("matched");
  });

  it("marks saved-card reconcile failed as failed", () => {
    const row: ZohoInvoiceAuthorizationChargeRow = {
      id: "auth-2",
      invoice_number: "INV-201",
      zoho_invoice_id: "inv-201",
      payment_method_id: "pm-1",
      customer_email: "c@d.com",
      amount_cents: 7500,
      currency: "ZAR",
      paystack_reference: "pay-201",
      paystack_status: "success",
      zoho_payment_id: null,
      zoho_status: null,
      status: "zoho_reconcile_failed",
      initiated_by_admin_id: "admin-1",
      reason: "Admin charge",
      metadata: {},
      reconcile_attempts: 5,
      last_reconcile_attempt_at: "2026-07-01T11:00:00.000Z",
      next_reconcile_attempt_at: null,
      last_reconcile_error: "timeout",
      created_at: "2026-07-01T10:00:00.000Z",
      paid_at: "2026-07-01T10:05:00.000Z",
      failed_at: null,
    };
    const [item] = buildSavedCardItems([row]);
    expect(item.reconciliationStatus).toBe("failed");
    expect(item.issueCode).toBe("ZOHO_SYNC_FAILED");
  });

  it("marks refund credit synced with credit note id as matched", () => {
    const row: ZohoRefundCreditSyncRow = {
      id: "ref-1",
      source_type: "booking_refund",
      source_id: "src-1",
      booking_id: "booking-1",
      invoice_number: "INV-001",
      zoho_invoice_id: "inv-1",
      zoho_credit_note_id: "cn-1",
      zoho_refund_id: null,
      paystack_reference: "pay-ref",
      amount_cents: 5000,
      currency: "ZAR",
      reason: "Refund",
      sync_status: "synced",
      sync_attempts: 1,
      last_sync_attempt_at: null,
      next_sync_attempt_at: null,
      last_sync_error: null,
      metadata: {},
      initiated_by_admin_id: null,
      created_at: "2026-07-01T10:00:00.000Z",
      updated_at: "2026-07-01T10:05:00.000Z",
      synced_at: "2026-07-01T10:05:00.000Z",
    };
    const [item] = buildRefundCreditItems([row]);
    expect(item.reconciliationStatus).toBe("matched");
    expect(item.issueCode).toBe("MATCHED");
  });

  it("marks refund credit failed as failed", () => {
    const row: ZohoRefundCreditSyncRow = {
      id: "ref-2",
      source_type: "booking_refund",
      source_id: "src-2",
      booking_id: "booking-2",
      invoice_number: null,
      zoho_invoice_id: null,
      zoho_credit_note_id: null,
      zoho_refund_id: null,
      paystack_reference: null,
      amount_cents: 5000,
      currency: "ZAR",
      reason: "Refund",
      sync_status: "failed",
      sync_attempts: 5,
      last_sync_attempt_at: "2026-07-01T11:00:00.000Z",
      next_sync_attempt_at: null,
      last_sync_error: "ZOHO_ERROR",
      metadata: {},
      initiated_by_admin_id: null,
      created_at: "2026-07-01T10:00:00.000Z",
      updated_at: "2026-07-01T11:00:00.000Z",
      synced_at: null,
    };
    const [item] = buildRefundCreditItems([row]);
    expect(item.reconciliationStatus).toBe("failed");
    expect(item.issueCode).toBe("CREDIT_NOTE_FAILED");
  });

  it("computes amount summaries correctly", () => {
    const summary = computeSummary([
      {
        id: "1",
        source: "booking",
        reference: "r1",
        bookingId: null,
        invoiceNumber: null,
        customerLabel: null,
        amountCents: 1000,
        currency: "ZAR",
        shaleanStatus: "paid",
        paystackStatus: "success",
        zohoStatus: "synced",
        reconciliationStatus: "matched",
        issueCode: "MATCHED",
        issueLabel: "Matched",
        createdAt: "2026-07-01T10:00:00.000Z",
        paidAt: null,
        syncedAt: null,
        actionHint: null,
      },
      {
        id: "2",
        source: "zoho_invoice",
        reference: "r2",
        bookingId: null,
        invoiceNumber: null,
        customerLabel: null,
        amountCents: 2000,
        currency: "ZAR",
        shaleanStatus: "pending_paystack",
        paystackStatus: "pending",
        zohoStatus: null,
        reconciliationStatus: "pending",
        issueCode: "PAYSTACK_PENDING",
        issueLabel: "Paystack pending",
        createdAt: "2026-07-01T09:00:00.000Z",
        paidAt: null,
        syncedAt: null,
        actionHint: null,
      },
    ]);

    expect(summary.matchedCount).toBe(1);
    expect(summary.pendingCount).toBe(1);
    expect(summary.matchedAmountCents).toBe(1000);
    expect(summary.pendingAmountCents).toBe(2000);
    expect(summary.totalAmountCents).toBe(3000);
    expect(summary.oldestPendingAt).toBe("2026-07-01T09:00:00.000Z");
  });
});
