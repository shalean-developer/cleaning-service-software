import { describe, expect, it } from "vitest";
import { resolveAdminAssistPaidVia } from "./resolveAdminAssistPaidVia";

const adminAssistMeta = {
  adminAssist: {
    source: "admin_wizard",
    createdByProfileId: "admin-1",
    createdAt: "2026-01-01T10:00:00.000Z",
    paymentLink: {
      paymentUrl: "https://checkout.paystack.com/x",
      reference: "bk_ref",
      expiresAt: "2026-01-02T10:00:00.000Z",
      generatedAt: "2026-01-01T10:00:00.000Z",
      generatedByProfileId: "admin-1",
      deliveryChannel: "copy_only",
      paymentId: "pay-1",
    },
  },
};

describe("resolveAdminAssistPaidVia", () => {
  it("returns null when not admin-assisted", () => {
    expect(
      resolveAdminAssistPaidVia({
        metadata: {},
        bookingStatus: "confirmed",
        paymentStatus: "paid",
        paymentProvider: "paystack",
      }),
    ).toBeNull();
  });

  it("returns paystack_link when paid via Paystack after link", () => {
    expect(
      resolveAdminAssistPaidVia({
        metadata: adminAssistMeta,
        bookingStatus: "confirmed",
        paymentStatus: "paid",
        paymentProvider: "paystack",
      }),
    ).toBe("paystack_link");
  });

  it("returns offline for EFT/cash/card_machine providers", () => {
    for (const provider of ["eft", "cash", "card_machine"] as const) {
      expect(
        resolveAdminAssistPaidVia({
          metadata: adminAssistMeta,
          bookingStatus: "pending_assignment",
          paymentStatus: "paid",
          paymentProvider: provider,
        }),
      ).toBe("offline");
    }
  });

  it("returns null for pending payment", () => {
    expect(
      resolveAdminAssistPaidVia({
        metadata: adminAssistMeta,
        bookingStatus: "pending_payment",
        paymentStatus: "pending",
        paymentProvider: "paystack",
      }),
    ).toBeNull();
  });
});
