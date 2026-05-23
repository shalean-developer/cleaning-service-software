import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminBookingWizardConfirmationActions } from "./components/AdminBookingWizardConfirmationActions";
import {
  EMPTY_ADMIN_BOOKING_WIZARD_FORM,
  type AdminBookingWizardFormState,
} from "./draftFormState";
import { adminConfirmationActionsTestProps } from "./adminBookingWizardTestFixtures";

const wizardDir = path.join(process.cwd(), "src/features/admin-booking-wizard");

function buttonMarkupHasDisabled(html: string, testId: string): boolean {
  const marker = `data-testid="${testId}"`;
  const idx = html.indexOf(marker);
  if (idx < 0) return false;
  const start = html.lastIndexOf("<button", idx);
  const end = html.indexOf(">", idx);
  if (start < 0 || end < 0) return false;
  return html.slice(start, end + 1).includes("disabled");
}

const readyForm: AdminBookingWizardFormState = {
  ...EMPTY_ADMIN_BOOKING_WIZARD_FORM,
  customerId: "11111111-1111-4111-8111-111111111111",
  selectedCustomer: {
    customerId: "11111111-1111-4111-8111-111111111111",
    label: "Jane",
    email: "jane@example.com",
    phone: null,
  },
  serviceSlug: "regular-cleaning",
  date: "2099-06-01",
  time: "09:00",
  addressLine1: "12 Main",
  suburb: "Sea Point",
  city: "Cape Town",
};

describe("Admin booking wizard Phase 4B", () => {
  it("disables send payment request when payment-link flag is off", () => {
    const html = renderToStaticMarkup(
      <AdminBookingWizardConfirmationActions
        featureEnabled={true}
        paymentLinksEnabled={false}
        offlinePaymentsEnabled={false}
        form={readyForm}
        {...adminConfirmationActionsTestProps}
      />,
    );
    expect(buttonMarkupHasDisabled(html, "admin-booking-send-payment-request")).toBe(true);
  });

  it("disables send payment request before pending_payment", () => {
    const html = renderToStaticMarkup(
      <AdminBookingWizardConfirmationActions
        featureEnabled={true}
        paymentLinksEnabled={true}
        offlinePaymentsEnabled={false}
        form={readyForm}
        {...adminConfirmationActionsTestProps}
      />,
    );
    expect(buttonMarkupHasDisabled(html, "admin-booking-send-payment-request")).toBe(true);
  });

  it("keeps finalize paid disabled", () => {
    const html = renderToStaticMarkup(
      <AdminBookingWizardConfirmationActions
        featureEnabled={true}
        paymentLinksEnabled={true}
        offlinePaymentsEnabled={false}
        form={readyForm}
        {...adminConfirmationActionsTestProps}
      />,
    );
    expect(buttonMarkupHasDisabled(html, "admin-booking-finalize-paid")).toBe(true);
  });

  it("wires payment-link API in api module", () => {
    const source = readFileSync(path.join(wizardDir, "api.ts"), "utf8");
    expect(source).toContain("/payment-link");
    expect(source).toContain("generateAdminPaymentLink");
  });
});

describe("admin payment link phase 4b safety (static)", () => {
  const files = [
    path.join(wizardDir, "components/AdminBookingWizardConfirmationActions.tsx"),
    path.join(wizardDir, "api.ts"),
    path.join(
      process.cwd(),
      "src/features/bookings/server/admin/adminGeneratePaymentLinkFacade.ts",
    ),
    path.join(
      process.cwd(),
      "src/app/api/admin/bookings/[bookingId]/payment-link/route.ts",
    ),
    path.join(
      process.cwd(),
      "src/components/dashboard/admin/AdminBookingDetailPaymentLinkPanel.tsx",
    ),
  ];

  const FORBIDDEN_PATTERNS = [
    /\bfinalizePaidBooking\b/,
    /\brunPostPaymentAssignmentDispatch\b/,
    /\brunAssignmentAfterPayment\b/,
    /\bADMIN_RECORD_OFFLINE_PAYMENT\b/,
    /\bADMIN_CREATE_BOOKING\b/,
    /\bADMIN_OVERRIDE_STATUS\b/,
  ];

  for (const abs of files) {
    it(`${path.basename(abs)} has no forbidden payment/assignment imports`, () => {
      const source = readFileSync(abs, "utf8");
      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(source).not.toMatch(pattern);
      }
    });
  }
});

describe("admin booking detail Phase 4B", () => {
  const pageSource = readFileSync(
    path.join(process.cwd(), "src/app/(admin)/admin/bookings/[bookingId]/page.tsx"),
    "utf8",
  );
  const panelSource = readFileSync(
    path.join(
      process.cwd(),
      "src/components/dashboard/admin/AdminBookingDetailPaymentLinkPanel.tsx",
    ),
    "utf8",
  );

  it("renders payment link panel for admin-assisted pending_payment", () => {
    expect(pageSource).toContain("AdminBookingDetailPaymentLinkPanel");
    expect(pageSource).toContain('b.status === "pending_payment"');
    expect(pageSource).toContain("isAdminAssistedPaymentLinksActive");
  });

  it("shows assignment warning on payment link panel", () => {
    expect(panelSource).toContain(
      "Cleaner assignment begins only after successful payment confirmation",
    );
  });

  it("hides panel when payment links flag is off", () => {
    expect(panelSource).toContain("if (!paymentLinksEnabled)");
    expect(panelSource).toContain("return null");
  });
});
