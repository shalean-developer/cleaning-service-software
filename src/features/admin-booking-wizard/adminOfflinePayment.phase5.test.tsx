import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

const FORBIDDEN_PATTERNS = [
  /\bADMIN_OVERRIDE_STATUS\b/,
  /\brunPostPaymentAssignmentDispatch\b/,
  /\brunAssignmentAfterPayment\b/,
  /\bcreateDispatchOffer\b/,
  /\bOFFER_TO_CLEANER\b/,
  /\bearnings\b/,
  /\bpayout\b/,
  /\brecurring\b/,
  /\.update\(\s*\{[^}]*status:\s*["']confirmed["']/,
];

describe("admin offline payment phase 5 safety (static)", () => {
  const files = [
    "src/features/bookings/server/admin/adminRecordOfflinePaymentFacade.ts",
    "src/app/api/admin/bookings/[bookingId]/offline-payment/route.ts",
    "src/components/dashboard/admin/AdminBookingDetailOfflinePaymentPanel.tsx",
    "src/features/admin-booking-wizard/components/AdminBookingWizardConfirmationActions.tsx",
  ];

  for (const rel of files) {
    it(`${path.basename(rel)} avoids forbidden lifecycle bypasses`, () => {
      const source = readFileSync(path.join(root, rel), "utf8");
      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(source).not.toMatch(pattern);
      }
    });
  }

  it("facade calls finalizePaidBooking only", () => {
    const source = readFileSync(
      path.join(root, "src/features/bookings/server/admin/adminRecordOfflinePaymentFacade.ts"),
      "utf8",
    );
    expect(source).toContain("finalizePaidBookingWithDeps");
    expect(source).not.toMatch(/\bexecuteBookingCommand\s*\(/);
  });
});

describe("admin offline payment UI wiring", () => {
  const panelSource = readFileSync(
    path.join(root, "src/components/dashboard/admin/AdminBookingDetailOfflinePaymentPanel.tsx"),
    "utf8",
  );

  it("shows warning and confirmation checkbox", () => {
    expect(panelSource).toContain("admin-booking-offline-payment-warning");
    expect(panelSource).toContain("admin-booking-offline-payment-confirm");
    expect(panelSource).toContain("finalize the booking");
  });

  it("hides panel when flag off", () => {
    expect(panelSource).toContain("if (!offlinePaymentsEnabled");
  });

  it("renders rail-specific fields", () => {
    expect(panelSource).toContain("admin-booking-offline-payment-bank-reference");
    expect(panelSource).toContain("admin-booking-offline-payment-terminal-reference");
    expect(panelSource).toContain("admin-booking-offline-payment-receipt-number");
  });
});
