import { describe, expect, it } from "vitest";
import {
  buildOfflinePaymentChargeForFinalize,
  buildOfflinePaymentReference,
} from "./buildOfflinePaymentChargeForFinalize";

describe("buildOfflinePaymentChargeForFinalize", () => {
  it("builds admin offline reference and metadata", () => {
    const charge = buildOfflinePaymentChargeForFinalize({
      rail: "eft",
      amountCents: 45000,
      currency: "ZAR",
      paidAt: "2026-01-01T10:00:00.000Z",
      idempotencyKey: "offline-key-12345678",
      eventId: "event-uuid",
      adminProfileId: "admin-1",
      evidenceReference: "EV-001",
      providerReference: "BNK-123",
      bankReference: "BNK-123",
    });

    expect(charge.reference).toBe(
      buildOfflinePaymentReference("eft", "offline-key-12345678"),
    );
    expect(charge.amountCents).toBe(45000);
    expect(charge.metadata.source).toBe("admin_offline_payment");
    expect(charge.metadata.rail).toBe("eft");
  });
});
