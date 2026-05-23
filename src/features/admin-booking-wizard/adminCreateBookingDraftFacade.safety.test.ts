import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

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

const UI_ONLY_WIZARD_FILES = [
  "components/AdminBookingWizard.tsx",
  "components/AdminBookingWizardCustomerStep.tsx",
  "components/AdminBookingWizardPricingPreview.tsx",
  "adminCustomerApi.ts",
  "pricingApi.ts",
];

describe("admin booking wizard phase 3 safety (static)", () => {
  for (const relativePath of UI_ONLY_WIZARD_FILES) {
    it(`${relativePath} must not import payment or assignment lifecycle`, () => {
      const source = readFileSync(path.join(wizardDir, relativePath), "utf8");
      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(source).not.toMatch(pattern);
      }
      expect(source).not.toMatch(/\/api\/admin\/bookings(?!\/draft)/);
    });
  }

  it("confirmation actions must not import forbidden lifecycle symbols", () => {
    const source = readFileSync(
      path.join(wizardDir, "components/AdminBookingWizardConfirmationActions.tsx"),
      "utf8",
    );
    for (const pattern of FORBIDDEN_PATTERNS) {
      expect(source).not.toMatch(pattern);
    }
  });

  it("api module exposes assisted booking routes without forbidden imports", () => {
    const apiSource = readFileSync(path.join(wizardDir, "api.ts"), "utf8");
    for (const pattern of FORBIDDEN_PATTERNS) {
      expect(apiSource).not.toMatch(pattern);
    }
    expect(apiSource).toContain("/api/admin/bookings/draft");
    expect(apiSource).toContain("/pending-payment");
    expect(apiSource).toContain("fetchAdminBookingWizardFlowDetail");
  });

  it("draft save uses draft API only", () => {
    const actionsSource = readFileSync(
      path.join(wizardDir, "components/AdminBookingWizardConfirmationActions.tsx"),
      "utf8",
    );
    const apiSource = readFileSync(path.join(wizardDir, "api.ts"), "utf8");
    expect(actionsSource).toContain("saveAdminBookingDraft");
    expect(apiSource).toContain("/api/admin/bookings/draft");
  });
});
