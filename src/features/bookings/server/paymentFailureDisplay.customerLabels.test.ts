import { describe, expect, it } from "vitest";
import {
  CUSTOMER_FINDING_CLEANER_LABEL,
  labelForCustomerBookingStatus,
  labelForCustomerPaymentStatus,
} from "./paymentFailureDisplay";

describe("labelForCustomerBookingStatus (Sprint A)", () => {
  it("uses unified assignment wording for pending_assignment", () => {
    expect(labelForCustomerBookingStatus("pending_assignment")).toBe(
      CUSTOMER_FINDING_CLEANER_LABEL,
    );
    expect(CUSTOMER_FINDING_CLEANER_LABEL).toBe("Finding your cleaner");
  });
});

describe("labelForCustomerPaymentStatus (Sprint A)", () => {
  it("maps payment states to customer-friendly labels", () => {
    expect(labelForCustomerPaymentStatus(null)).toBe("Payment pending");
    expect(labelForCustomerPaymentStatus("paid")).toBe("Paid");
    expect(labelForCustomerPaymentStatus("initialized")).toBe("Payment pending");
    expect(labelForCustomerPaymentStatus("pending")).toBe("Payment pending");
    expect(labelForCustomerPaymentStatus("failed")).toBe("Payment not completed");
    expect(labelForCustomerPaymentStatus("refunded")).toBe("Payment not completed");
  });

  it("never exposes internal payment terminology", () => {
    for (const status of ["initialized", "pending", "paid", "failed", "refunded"] as const) {
      const label = labelForCustomerPaymentStatus(status);
      expect(label).not.toMatch(/initialized/i);
      expect(label).not.toMatch(/refunded/i);
    }
  });
});
