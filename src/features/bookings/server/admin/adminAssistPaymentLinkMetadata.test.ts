import { describe, expect, it } from "vitest";
import {
  isAdminAssistPaymentLinkActive,
  isAdminAssistPaymentLinkExpired,
  mergeAdminAssistPaymentLinkMetadata,
  readAdminAssistPaymentLinkMetadata,
  resolveAdminAssistPaymentRequestVisibility,
  supersedeAdminAssistPaymentLink,
} from "./adminAssistPaymentLinkMetadata";

const sampleLink = {
  paymentUrl: "https://checkout.paystack.com/test",
  reference: "bk_ref_1",
  expiresAt: "2099-01-01T00:00:00.000Z",
  generatedAt: "2026-01-01T00:00:00.000Z",
  generatedByProfileId: "admin-1",
  deliveryChannel: "copy_only" as const,
  paymentId: "pay-1",
};

describe("adminAssistPaymentLinkMetadata", () => {
  it("detects active and expired links from expiresAt", () => {
    const active = { ...sampleLink, expiresAt: new Date(Date.now() + 60_000).toISOString() };
    expect(isAdminAssistPaymentLinkActive(active)).toBe(true);
    expect(isAdminAssistPaymentLinkExpired(active)).toBe(false);

    const expired = { ...sampleLink, expiresAt: new Date(Date.now() - 60_000).toISOString() };
    expect(isAdminAssistPaymentLinkActive(expired)).toBe(false);
    expect(isAdminAssistPaymentLinkExpired(expired)).toBe(true);
  });

  it("stores superseded links in paymentLinkHistory", () => {
    const superseded = supersedeAdminAssistPaymentLink(sampleLink);
    const merged = mergeAdminAssistPaymentLinkMetadata(
      {
        adminAssist: { source: "admin_wizard", phase: "draft_only" },
      },
      { ...sampleLink, reference: "bk_ref_2" },
      { supersededLinks: [superseded] },
    );

    expect(readAdminAssistPaymentLinkMetadata(merged as never)?.reference).toBe("bk_ref_2");
    const visibility = resolveAdminAssistPaymentRequestVisibility(
      merged as never,
      "pending_payment",
      true,
    );
    expect(visibility.supersededLinks).toHaveLength(1);
    expect(visibility.supersededLinks[0]?.reference).toBe("bk_ref_1");
  });

  it("resolves payment request states for admin-assisted pending_payment", () => {
    const activeMeta = mergeAdminAssistPaymentLinkMetadata(
      { adminAssist: { source: "admin_wizard" } },
      { ...sampleLink, expiresAt: new Date(Date.now() + 3600_000).toISOString() },
    );

    expect(
      resolveAdminAssistPaymentRequestVisibility(activeMeta as never, "pending_payment", true)
        .state,
    ).toBe("link_active");

    const expiredMeta = mergeAdminAssistPaymentLinkMetadata(
      { adminAssist: { source: "admin_wizard" } },
      { ...sampleLink, expiresAt: new Date(Date.now() - 3600_000).toISOString() },
    );

    expect(
      resolveAdminAssistPaymentRequestVisibility(expiredMeta as never, "pending_payment", true)
        .state,
    ).toBe("link_expired");
  });
});
