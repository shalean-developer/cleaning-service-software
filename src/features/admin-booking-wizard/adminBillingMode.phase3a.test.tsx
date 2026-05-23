import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  isCustomerEligibleForMonthlyAccountWizard,
  resolveMonthlyAccountDisabledReason,
} from "./adminBillingMode";
import { AdminBookingWizardBillingModePanel } from "./components/AdminBookingWizardBillingModePanel";
import { AdminBookingWizardConfirmationActions } from "./components/AdminBookingWizardConfirmationActions";
import { AdminBookingWizardSummarySidebar } from "./components/AdminBookingWizardSummarySidebar";
import {
  buildAdminDraftRequestBody,
  EMPTY_ADMIN_BOOKING_WIZARD_FORM,
} from "./draftFormState";
import { adminConfirmationActionsTestProps } from "./adminBookingWizardTestFixtures";
import { readFileSync } from "node:fs";
import path from "node:path";

const approvedAccount = {
  customerId: "11111111-1111-4111-8111-111111111111",
  accountId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  monthlyAccountEnabled: true,
  billingMode: "monthly_account",
  zohoCustomerId: "zoho-123",
  billingEmail: "billing@example.com",
  billingTerms: "Net 30",
  approvedAt: "2026-01-01T00:00:00.000Z",
  approvedByAdminId: "admin-1",
  accountStatusLabel: "Monthly account active",
};

const readyForm = {
  ...EMPTY_ADMIN_BOOKING_WIZARD_FORM,
  customerId: approvedAccount.customerId,
  selectedCustomer: {
    customerId: approvedAccount.customerId,
    label: "Jane",
    email: "jane@example.com",
    phone: null,
  },
  serviceSlug: "regular-cleaning" as const,
  date: "2099-06-01",
  time: "09:00",
  addressLine1: "12 Main",
  suburb: "Sea Point",
  city: "Cape Town",
};

function buttonMarkupHasDisabled(html: string, testId: string): boolean {
  const marker = `data-testid="${testId}"`;
  const idx = html.indexOf(marker);
  if (idx < 0) return false;
  const start = html.lastIndexOf("<button", idx);
  const end = html.indexOf(">", idx);
  if (start < 0 || end < 0) return false;
  return html.slice(start, end + 1).includes("disabled");
}

describe("admin billing mode phase 3A", () => {
  it("monthly account disabled for non-approved customer", () => {
    expect(
      isCustomerEligibleForMonthlyAccountWizard(null, true),
    ).toBe(false);
    expect(resolveMonthlyAccountDisabledReason(null, true)).toContain(
      "Enable monthly billing",
    );
  });

  it("monthly account enabled for approved customer", () => {
    expect(isCustomerEligibleForMonthlyAccountWizard(approvedAccount, true)).toBe(true);
    expect(resolveMonthlyAccountDisabledReason(approvedAccount, true)).toBeNull();
  });

  it("billing mode selector renders all options", () => {
    const html = renderToStaticMarkup(
      <AdminBookingWizardBillingModePanel
        form={{ ...readyForm, customerBillingAccount: approvedAccount }}
        monthlyBillingEnabled={true}
        onFormChange={() => {}}
      />,
    );
    expect(html).toContain('data-testid="admin-booking-billing-mode-panel"');
    expect(html).toContain('data-testid="admin-booking-billing-mode-option-paystack_link"');
    expect(html).toContain('data-testid="admin-booking-billing-mode-option-offline_payment"');
    expect(html).toContain('data-testid="admin-booking-billing-mode-option-monthly_account"');
  });

  it("monthly account option disabled when customer not approved", () => {
    const html = renderToStaticMarkup(
      <AdminBookingWizardBillingModePanel
        form={readyForm}
        monthlyBillingEnabled={true}
        onFormChange={() => {}}
      />,
    );
    expect(html).toContain("Enable monthly billing on the customer profile first.");
    expect(html).toContain('disabled=""');
  });

  it("sidebar shows billing mode label", () => {
    const html = renderToStaticMarkup(
      <AdminBookingWizardSummarySidebar
        summary={{
          customerLabel: "Jane",
          serviceLabel: "Regular cleaning",
          scheduleLabel: "2099-06-01 · 09:00",
          addressLabel: "12 Main, Sea Point, Cape Town",
          extrasLabel: "None",
          accessNotesLabel: "None",
          specialInstructionsLabel: "None",
          frequencyLabel: "Once-off",
          recurringScheduleLabel: "—",
          totalLabel: "R0",
          paymentLabel: "Not started",
          billingModeLabel: "Monthly account",
          lifecyclePreview: "Draft not saved",
        }}
      />,
    );
    expect(html).toContain("Billing mode");
    expect(html).toContain("Monthly account");
  });

  it("unsafe payment actions hidden for monthly_account; authorize when flag on", () => {
    const htmlDisabled = renderToStaticMarkup(
      <AdminBookingWizardConfirmationActions
        featureEnabled={true}
        paymentLinksEnabled={true}
        offlinePaymentsEnabled={true}
        monthlyServiceAuthorizationEnabled={false}
        form={{
          ...readyForm,
          billingMode: "monthly_account",
          customerBillingAccount: approvedAccount,
        }}
        flow={{
          ...adminConfirmationActionsTestProps.flow,
          saved: {
            bookingId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            customerId: approvedAccount.customerId,
            priceCents: 50000,
          },
        }}
        onFlowChange={adminConfirmationActionsTestProps.onFlowChange}
        onFlowRefresh={adminConfirmationActionsTestProps.onFlowRefresh}
      />,
    );
    expect(htmlDisabled).not.toContain('data-testid="admin-booking-create-unpaid"');
    expect(htmlDisabled).toContain("Monthly service authorization is disabled");

    const htmlEnabled = renderToStaticMarkup(
      <AdminBookingWizardConfirmationActions
        featureEnabled={true}
        paymentLinksEnabled={true}
        offlinePaymentsEnabled={true}
        monthlyBillingEnabled={true}
        monthlyServiceAuthorizationEnabled={true}
        form={{
          ...readyForm,
          billingMode: "monthly_account",
          customerBillingAccount: approvedAccount,
        }}
        flow={{
          ...adminConfirmationActionsTestProps.flow,
          saved: {
            bookingId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            customerId: approvedAccount.customerId,
            priceCents: 50000,
          },
        }}
        onFlowChange={adminConfirmationActionsTestProps.onFlowChange}
        onFlowRefresh={adminConfirmationActionsTestProps.onFlowRefresh}
      />,
    );
    expect(htmlEnabled).toContain('data-testid="admin-booking-authorize-service-panel"');
  });

  it("buildAdminDraftRequestBody includes billing metadata", () => {
    const body = buildAdminDraftRequestBody(
      {
        ...readyForm,
        billingMode: "monthly_account",
        customerBillingAccount: approvedAccount,
      },
      "idem-key-12345678",
    );
    expect(body?.billing.mode).toBe("monthly_account");
    expect(body?.billing.monthlyAccountId).toBe(approvedAccount.accountId);
    expect(body?.billing.billingTerms).toBe("Net 30");
  });

  it("paystack_link default stored in draft body", () => {
    const body = buildAdminDraftRequestBody(readyForm, "idem-key-12345678");
    expect(body?.billing.mode).toBe("paystack_link");
    expect(body?.billing.monthlyAccountId).toBeUndefined();
  });
});

describe("admin billing mode phase 3A safety (static)", () => {
  const wizardDir = path.join(process.cwd(), "src/features/admin-booking-wizard");
  const bookingsAdminDir = path.join(process.cwd(), "src/features/bookings/server/admin");

  const FORBIDDEN = [
    /\bfinalizePaidBooking\b/,
    /\brunPostPaymentAssignmentDispatch\b/,
    /\brunAssignmentAfterPayment\b/,
    /\bcreateMonthlyInvoiceBatch\b/,
    /\baccrueMonthlyInvoiceItem\b/,
    /\bsyncZohoInvoicePayment\b/,
  ];

  for (const relativePath of [
    "adminCreateBookingDraftFacade.ts",
    "validateAdminWizardBillingMode.ts",
    "buildAdminBookingDraftMetadata.ts",
  ]) {
    it(`${relativePath} must not import forbidden lifecycle symbols`, () => {
      const source = readFileSync(path.join(bookingsAdminDir, relativePath), "utf8");
      for (const pattern of FORBIDDEN) {
        expect(source).not.toMatch(pattern);
      }
    });
  }

  it("draft facade only uses CREATE_BOOKING_DRAFT command path", () => {
    const source = readFileSync(
      path.join(bookingsAdminDir, "adminCreateBookingDraftFacade.ts"),
      "utf8",
    );
    expect(source).toContain('"CREATE_BOOKING_DRAFT"');
    expect(source).not.toMatch(/\bADMIN_CREATE_PENDING_PAYMENT_BOOKING\b/);
  });

  it("wizard billing panel does not trigger payment link creation", () => {
    const source = readFileSync(
      path.join(wizardDir, "components/AdminBookingWizardBillingModePanel.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/generateAdminPaymentLink/);
    expect(source).not.toMatch(/createAdminPendingPaymentBooking/);
  });
});
