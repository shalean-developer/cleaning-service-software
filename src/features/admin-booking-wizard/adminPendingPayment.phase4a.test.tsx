import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminBookingWizardConfirmationActions } from "./components/AdminBookingWizardConfirmationActions";
import {
  EMPTY_ADMIN_BOOKING_WIZARD_FORM,
  type AdminBookingWizardFormState,
} from "./draftFormState";

const wizardDir = path.join(process.cwd(), "src/features/admin-booking-wizard");

const FORBIDDEN_PATTERNS = [
  /\bfinalizePaidBooking\b/,
  /\binitializePayment\b/,
  /\bcompletePaystackInitialize\b/,
  /\bADMIN_GENERATE_PAYMENT_LINK\b/,
  /\bADMIN_RECORD_OFFLINE_PAYMENT\b/,
  /\bADMIN_CREATE_BOOKING\b/,
  /\brunPostPaymentAssignmentDispatch\b/,
  /\brunAssignmentAfterPayment\b/,
];

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
    email: null,
    phone: null,
  },
  serviceSlug: "regular-cleaning",
  date: "2099-06-01",
  time: "09:00",
  addressLine1: "12 Main",
  suburb: "Sea Point",
  city: "Cape Town",
};

describe("Admin booking wizard Phase 4A", () => {
  it("disables create unpaid before draft exists", () => {
    const html = renderToStaticMarkup(
      <AdminBookingWizardConfirmationActions
        featureEnabled={true}
        paymentLinksEnabled={false}
        offlinePaymentsEnabled={false}
        form={readyForm}
      />,
    );
    expect(buttonMarkupHasDisabled(html, "admin-booking-create-unpaid")).toBe(true);
  });

  it("keeps finalize and payment request disabled", () => {
    const html = renderToStaticMarkup(
      <AdminBookingWizardConfirmationActions
        featureEnabled={true}
        paymentLinksEnabled={false}
        offlinePaymentsEnabled={false}
        form={readyForm}
      />,
    );
    expect(buttonMarkupHasDisabled(html, "admin-booking-finalize-paid")).toBe(true);
    expect(buttonMarkupHasDisabled(html, "admin-booking-send-payment-request")).toBe(true);
  });

  it("wires pending-payment API in api module", () => {
    const source = readFileSync(path.join(wizardDir, "api.ts"), "utf8");
    expect(source).toContain("/pending-payment");
    expect(source).toContain("createAdminPendingPaymentBooking");
  });
});

describe("admin pending payment phase 4a safety (static)", () => {
  const phase4aFiles = [
    path.join(wizardDir, "components/AdminBookingWizardConfirmationActions.tsx"),
    path.join(wizardDir, "api.ts"),
    path.join(
      process.cwd(),
      "src/features/bookings/server/admin/adminCreatePendingPaymentBookingFacade.ts",
    ),
    path.join(
      process.cwd(),
      "src/app/api/admin/bookings/[bookingId]/pending-payment/route.ts",
    ),
  ];

  for (const abs of phase4aFiles) {
    it(`${path.basename(abs)} has no forbidden payment/assignment imports`, () => {
      const source = readFileSync(abs, "utf8");
      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(source).not.toMatch(pattern);
      }
    });
  }
});

describe("admin booking detail Phase 4A", () => {
  const pageSource = readFileSync(
    path.join(process.cwd(), "src/app/(admin)/admin/bookings/[bookingId]/page.tsx"),
    "utf8",
  );

  it("shows pending payment badge and ops copy", () => {
    expect(pageSource).toContain("Admin-assisted pending payment");
    expect(pageSource).toContain("No cleaner assignment starts until payment");
  });

  it("still shows draft badge for draft status", () => {
    expect(pageSource).toContain("Admin-assisted draft");
    expect(pageSource).toContain('b.status === "draft"');
  });
});
