import { describe, expect, it } from "vitest";
import {
  mapBookingPaymentStatus,
  mapSavedCardInvoiceChargeStatus,
  mapZohoInvoicePaymentStatus,
} from "./mapCustomerPaymentStatus";
import { labelForCustomerPaymentHistoryStatus } from "../customerPaymentHistoryLabels";

describe("mapCustomerPaymentStatus", () => {
  it("maps booking payment statuses", () => {
    expect(mapBookingPaymentStatus("paid")).toBe("paid");
    expect(mapBookingPaymentStatus("pending")).toBe("pending");
    expect(mapBookingPaymentStatus("initialized")).toBe("pending");
    expect(mapBookingPaymentStatus("failed")).toBe("failed");
    expect(mapBookingPaymentStatus("refunded")).toBe("failed");
  });

  it("maps Zoho invoice checkout statuses", () => {
    expect(mapZohoInvoicePaymentStatus("paid")).toBe("paid");
    expect(mapZohoInvoicePaymentStatus("pending_paystack")).toBe("pending");
    expect(mapZohoInvoicePaymentStatus("zoho_reconcile_pending")).toBe("pending");
    expect(mapZohoInvoicePaymentStatus("initialized")).toBe("pending");
    expect(mapZohoInvoicePaymentStatus("failed")).toBe("failed");
    expect(mapZohoInvoicePaymentStatus("zoho_reconcile_failed")).toBe("failed");
    expect(mapZohoInvoicePaymentStatus("cancelled")).toBe("failed");
  });

  it("maps saved-card invoice charge statuses", () => {
    expect(mapSavedCardInvoiceChargeStatus("paid")).toBe("paid");
    expect(mapSavedCardInvoiceChargeStatus("initialized")).toBe("pending");
    expect(mapSavedCardInvoiceChargeStatus("submitted")).toBe("pending");
    expect(mapSavedCardInvoiceChargeStatus("pending_webhook")).toBe("pending");
    expect(mapSavedCardInvoiceChargeStatus("zoho_reconcile_pending")).toBe("pending");
    expect(mapSavedCardInvoiceChargeStatus("failed")).toBe("failed");
    expect(mapSavedCardInvoiceChargeStatus("zoho_reconcile_failed")).toBe("failed");
  });

  it("uses consistent customer-facing labels", () => {
    expect(labelForCustomerPaymentHistoryStatus("paid")).toBe("Paid");
    expect(labelForCustomerPaymentHistoryStatus("pending")).toBe("Pending");
    expect(labelForCustomerPaymentHistoryStatus("failed")).toBe("Failed");
  });
});
