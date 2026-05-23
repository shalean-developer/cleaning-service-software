import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const wizardDir = path.join(process.cwd(), "src/features/admin-booking-wizard");

const FORBIDDEN_PATTERNS = [
  /\bfinalizePaidBooking\b/,
  /\binitializePayment\b/,
  /\bADMIN_GENERATE_PAYMENT_LINK\b/,
  /\bADMIN_RECORD_OFFLINE_PAYMENT\b/,
  /\bADMIN_CREATE_PENDING_PAYMENT_BOOKING\b/,
  /\bADMIN_CREATE_BOOKING\b/,
  /\bMARK_PAYMENT_PENDING\b/,
  /\brunPostPaymentAssignmentDispatch\b/,
  /\brunAssignmentAfterPayment\b/,
];

const WIZARD_SOURCE_FILES = [
  "components/AdminBookingWizard.tsx",
  "components/AdminBookingWizardConfirmationActions.tsx",
  "components/AdminBookingWizardCustomerStep.tsx",
  "components/AdminBookingWizardPricingPreview.tsx",
  "api.ts",
  "adminCustomerApi.ts",
  "pricingApi.ts",
];

describe("admin booking wizard phase 3 safety (static)", () => {
  for (const relativePath of WIZARD_SOURCE_FILES) {
    it(`${relativePath} must not import payment or assignment lifecycle`, () => {
      const source = readFileSync(path.join(wizardDir, relativePath), "utf8");
      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(source).not.toMatch(pattern);
      }
      expect(source).not.toMatch(/\/api\/admin\/bookings(?!\/draft)/);
    });
  }

  it("draft save uses draft API only", () => {
    const actionsSource = readFileSync(
      path.join(wizardDir, "components/AdminBookingWizardConfirmationActions.tsx"),
      "utf8",
    );
    const apiSource = readFileSync(path.join(wizardDir, "api.ts"), "utf8");
    expect(actionsSource).toContain("saveAdminBookingDraft");
    expect(apiSource).toContain("/api/admin/bookings/draft");
    expect(apiSource).not.toMatch(/\/api\/admin\/bookings["']/);
  });
});
