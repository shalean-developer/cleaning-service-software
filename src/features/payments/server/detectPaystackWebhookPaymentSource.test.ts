import { describe, expect, it } from "vitest";
import {
  buildZohoInvoiceWebhookProviderEventId,
  detectPaystackWebhookPaymentSource,
  readZohoInvoicePaymentIdFromMetadata,
} from "./detectPaystackWebhookPaymentSource";

describe("detectPaystackWebhookPaymentSource", () => {
  it("routes metadata.source booking to booking handler", () => {
    expect(
      detectPaystackWebhookPaymentSource({ source: "booking" }, "zi_test_ref"),
    ).toBe("booking");
  });

  it("routes metadata.source zoho_invoice to Zoho handler", () => {
    expect(
      detectPaystackWebhookPaymentSource({ source: "zoho_invoice" }, "bk_test_ref"),
    ).toBe("zoho_invoice");
  });

  it("routes metadata.source zoho_invoice_authorization_charge to auth charge handler", () => {
    expect(
      detectPaystackWebhookPaymentSource(
        { source: "zoho_invoice_authorization_charge" },
        "zi_test_ref",
      ),
    ).toBe("zoho_invoice_authorization_charge");
  });

  it("routes zia_ prefix to auth charge handler before zi_", () => {
    expect(detectPaystackWebhookPaymentSource({}, "zia_INV_001602_ab12cd34")).toBe(
      "zoho_invoice_authorization_charge",
    );
  });

  it("routes zi_ prefix to Zoho handler", () => {
    expect(detectPaystackWebhookPaymentSource({}, "zi_INV_001602_ab12cd34")).toBe(
      "zoho_invoice",
    );
  });

  it("routes bk_ prefix to booking handler", () => {
    expect(detectPaystackWebhookPaymentSource({}, "bk_booking_ref_123")).toBe("booking");
  });

  it("falls back to booking for legacy events without source", () => {
    expect(detectPaystackWebhookPaymentSource({}, "legacy_ref_123")).toBe("booking");
  });
});

describe("buildZohoInvoiceWebhookProviderEventId", () => {
  it("builds stable provider event ids", () => {
    expect(buildZohoInvoiceWebhookProviderEventId("charge.success", 9001)).toBe(
      "paystack:charge.success:9001",
    );
    expect(buildZohoInvoiceWebhookProviderEventId("charge.failed", 9002)).toBe(
      "paystack:charge.failed:9002",
    );
  });
});

describe("readZohoInvoicePaymentIdFromMetadata", () => {
  it("reads zoho_invoice_payment_id from metadata", () => {
    expect(
      readZohoInvoicePaymentIdFromMetadata({ zoho_invoice_payment_id: "pay-123" }),
    ).toBe("pay-123");
    expect(readZohoInvoicePaymentIdFromMetadata({})).toBeNull();
  });
});
