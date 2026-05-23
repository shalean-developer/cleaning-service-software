import { describe, expect, it } from "vitest";
import { parseAdminRecordOfflinePaymentBody } from "./parseAdminRecordOfflinePaymentBody";

const base = {
  customerId: "11111111-1111-4111-8111-111111111111",
  amountCents: 45000,
  receivedAt: "2026-01-01T10:00:00.000Z",
  evidenceReference: "EV-001",
  reason: "Customer paid in branch",
  idempotencyKey: "offline-key-12345678",
};

describe("parseAdminRecordOfflinePaymentBody", () => {
  it("requires bankReference for EFT", () => {
    const result = parseAdminRecordOfflinePaymentBody({ ...base, rail: "eft" });
    expect(result.ok).toBe(false);
  });

  it("requires terminalReference for card_machine", () => {
    const result = parseAdminRecordOfflinePaymentBody({
      ...base,
      rail: "card_machine",
    });
    expect(result.ok).toBe(false);
  });

  it("requires receiptNumber for cash", () => {
    const result = parseAdminRecordOfflinePaymentBody({ ...base, rail: "cash" });
    expect(result.ok).toBe(false);
  });

  it("rejects future receivedAt", () => {
    const result = parseAdminRecordOfflinePaymentBody({
      ...base,
      rail: "eft",
      bankReference: "BNK-1",
      receivedAt: "2099-01-01T10:00:00.000Z",
    });
    expect(result.ok).toBe(false);
  });

  it("accepts valid EFT payload", () => {
    const result = parseAdminRecordOfflinePaymentBody({
      ...base,
      rail: "eft",
      bankReference: "BNK-123",
    });
    expect(result.ok).toBe(true);
  });
});
