import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AdminBookingBillingBadge,
  isMonthlyAccountBillingMetadata,
  parseBookingBillingMetadata,
} from "./bookingBillingMetadataDisplay";

describe("bookingBillingMetadataDisplay phase 3A", () => {
  it("parses extended billing metadata", () => {
    const metadata = {
      billing: {
        mode: "monthly_account",
        monthlyAccountId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        zohoCustomerId: "zoho-123",
        billingEmail: "billing@example.com",
        billingTerms: "Net 30",
        source: "admin_wizard",
      },
    };

    const parsed = parseBookingBillingMetadata(metadata);
    expect(parsed?.mode).toBe("monthly_account");
    expect(parsed?.zohoCustomerId).toBe("zoho-123");
    expect(isMonthlyAccountBillingMetadata(metadata)).toBe(true);
  });

  it("renders monthly account badge with authorization warning", () => {
    const html = renderToStaticMarkup(
      <AdminBookingBillingBadge
        metadata={{
          billing: {
            mode: "monthly_account",
            monthlyAccountId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            zohoCustomerId: "zoho-123",
            billingTerms: "Net 30",
          },
        }}
      />,
    );
    expect(html).toContain("Monthly account");
    expect(html).toContain("Awaiting service authorization");
  });

  it("renders service authorized badge when metadata present", () => {
    const html = renderToStaticMarkup(
      <AdminBookingBillingBadge
        metadata={{
          billing: {
            mode: "monthly_account",
            monthlyAccountId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            serviceAuthorization: {
              authorized: true,
              authorizedAt: "2026-06-01T10:00:00.000Z",
              authorizedByAdminProfileId: "admin-1",
              reason: "Approved",
              source: "admin_monthly_billing",
            },
          },
        }}
      />,
    );
    expect(html).toContain("Service authorized");
    expect(html).toContain("Not invoiced yet");
  });
});
