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

describe("admin payment request phase 4d safety (static)", () => {
  const files = [
    "src/features/bookings/server/admin/adminSendPaymentRequestNotificationFacade.ts",
    "src/app/api/admin/bookings/[bookingId]/payment-request/send/route.ts",
    "src/components/dashboard/admin/AdminBookingDetailPaymentLinkPanel.tsx",
    "src/features/admin-booking-wizard/components/AdminBookingWizardConfirmationActions.tsx",
    "src/features/admin-booking-wizard/api.ts",
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

describe("admin payment request phase 4d UI wiring", () => {
  const panelSource = readFileSync(
    path.join(root, "src/components/dashboard/admin/AdminBookingDetailPaymentLinkPanel.tsx"),
    "utf8",
  );
  const wizardSource = readFileSync(
    path.join(
      root,
      "src/features/admin-booking-wizard/components/AdminBookingWizardConfirmationActions.tsx",
    ),
    "utf8",
  );
  const apiSource = readFileSync(
    path.join(root, "src/features/admin-booking-wizard/api.ts"),
    "utf8",
  );

  it("wires send email only when customer has email on detail panel", () => {
    expect(panelSource).toContain("customerHasEmail");
    expect(panelSource).toContain("admin-booking-payment-request-send-email");
    expect(panelSource).toContain("canSendEmail");
  });

  it("shows WhatsApp copy when active link exists", () => {
    expect(panelSource).toContain("admin-booking-payment-request-copy-whatsapp");
    expect(panelSource).toContain("whatsapp_copy");
  });

  it("keeps regenerate separate from resend", () => {
    expect(panelSource).toContain("admin-booking-payment-link-regenerate");
    expect(panelSource).toContain("admin-booking-payment-request-resend");
  });

  it("wizard success state supports copy link, email, and WhatsApp", () => {
    expect(wizardSource).toContain("admin-booking-payment-link-copy");
    expect(wizardSource).toContain("admin-booking-payment-request-send-email");
    expect(wizardSource).toContain("admin-booking-payment-request-copy-whatsapp");
  });

  it("api module calls payment-request send route", () => {
    expect(apiSource).toContain("/payment-request/send");
    expect(apiSource).toContain("sendAdminPaymentRequestNotification");
  });

  it("finalize paid remains disabled in wizard", () => {
    expect(wizardSource).toContain('data-testid="admin-booking-finalize-paid"');
    expect(wizardSource).toMatch(/disabled/);
  });
});
