import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

const FORBIDDEN_PATTERNS = [
  /\bfinalizePaidBooking\b/,
  /\brunPostPaymentAssignmentDispatch\b/,
  /\brunAssignmentAfterPayment\b/,
  /\bADMIN_RECORD_OFFLINE_PAYMENT\b/,
  /\bADMIN_OVERRIDE_STATUS\b/,
];

describe("admin payment request phase 4c safety (static)", () => {
  const files = [
    "src/features/bookings/server/admin/adminGeneratePaymentLinkFacade.ts",
    "src/features/bookings/server/admin/adminRecordPaymentLinkCopiedFacade.ts",
    "src/app/api/admin/bookings/[bookingId]/payment-link/route.ts",
    "src/app/api/admin/bookings/[bookingId]/payment-link/copy/route.ts",
    "src/components/dashboard/admin/AdminBookingDetailPaymentLinkPanel.tsx",
  ];

  for (const rel of files) {
    it(`${path.basename(rel)} has no forbidden imports`, () => {
      const source = readFileSync(path.join(root, rel), "utf8");
      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(source).not.toMatch(pattern);
      }
    });
  }
});

describe("admin booking detail phase 4c ops copy", () => {
  const pageSource = readFileSync(
    path.join(root, "src/app/(admin)/admin/bookings/[bookingId]/page.tsx"),
    "utf8",
  );
  const panelSource = readFileSync(
    path.join(root, "src/components/dashboard/admin/AdminBookingDetailPaymentLinkPanel.tsx"),
    "utf8",
  );

  it("shows awaiting payment and assignment warnings", () => {
    expect(pageSource).toContain("Awaiting payment from customer");
    expect(pageSource).toContain("AdminBookingAssistOperatorTimeline");
    expect(pageSource).toContain("AdminBookingAssistSupportSummary");
    expect(panelSource).toContain("Cleaner assignment begins only after successful payment confirmation");
    expect(panelSource).toContain("This link expires on");
  });
});
