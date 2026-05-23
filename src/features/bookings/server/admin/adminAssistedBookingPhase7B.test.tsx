import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/lib/app/adminAssistedBookingDryRunFlag", () => ({
  isAdminAssistedBookingDryRunLabelingEnabled: () => true,
}));

import { isAdminAssistPilotDryRun } from "./adminAssistMetadata";
import { buildAdminBookingDraftMetadata } from "./buildAdminBookingDraftMetadata";
import { adminAssistedPilotPanelToCsv } from "./adminAssistedPilotExport";
import type { AdminAssistedPilotQaPanel } from "./loadAdminAssistedPilotQaPanel";
import { AdminAssistedPilotDryRunBanner } from "@/components/dashboard/admin/AdminAssistedPilotDryRunBanner";
import { AdminAssistedBookingTrainingAids } from "@/components/dashboard/admin/AdminAssistedBookingTrainingAids";
import { AdminAssistedPilotQaDashboard } from "@/components/dashboard/admin/AdminAssistedPilotQaDashboard";

const panelFixture: AdminAssistedPilotQaPanel = {
  generatedAt: "2026-05-23T10:00:00.000Z",
  readOnly: true,
  feedbackCount: 1,
  diagnostics: {
    generatedAt: "2026-05-23T10:00:00.000Z",
    readOnly: true,
    featureFlags: { bookingEnabled: true, paymentLinksEnabled: true, offlinePaymentsEnabled: false },
    counts: {
      assistedDrafts: 1,
      pendingPayment: 1,
      awaitingPayment: 1,
      paymentLinksActive: 0,
      paymentLinksExpired: 0,
      stalePendingPayment: 0,
      offlinePaymentsRecorded: 0,
      offlinePaymentsFinalized: 0,
      offlinePaymentsFailed: 0,
      confirmedAfterAssistPayment: 0,
      failedPaymentRequestNotifications: 0,
      assignmentDispatchAttention: 0,
      confirmedWithoutAssignmentDispatch: 0,
    },
    alerts: [],
    rolloutStage: "payment_links",
    analytics: {
      linksGenerated: 0,
      linksRegenerated: 0,
      emailsSent: 0,
      whatsappCopied: 0,
      expiredLinks: 0,
      paymentRequestsSentToday: 0,
      conversionRateGeneratedToPaid: null,
      averageDraftToPaidHours: null,
      averagePendingToConfirmedHours: null,
    },
    friction: {
      repeatedLinkRegenerations: 1,
      bookingsWithRepeatedRegenerate: 1,
      repeatedEmailResends: 0,
      bookingsWithRepeatedEmailResend: 0,
      longPendingPaymentBookings: 0,
      multipleFailedNotificationBookings: 0,
      offlinePaymentOverrides: 0,
      abandonedDrafts: 0,
      highOperatorActionBookings: 0,
      missingCustomerEmailBookings: 1,
      pilotDryRunBookings: 1,
    },
    operatorFeedbackCount: 1,
    scan: { bookingsScanned: 1, capped: false },
  },
  friction: {
    repeatedLinkRegenerations: 1,
    bookingsWithRepeatedRegenerate: 1,
    repeatedEmailResends: 0,
    bookingsWithRepeatedEmailResend: 0,
    longPendingPaymentBookings: 0,
    multipleFailedNotificationBookings: 0,
    offlinePaymentOverrides: 0,
    abandonedDrafts: 0,
    highOperatorActionBookings: 0,
    missingCustomerEmailBookings: 1,
    pilotDryRunBookings: 1,
  },
  flaggedBookings: [
    {
      bookingId: "b1",
      status: "pending_payment",
      customerLabel: "Jane",
      flags: ["pilot_dry_run", "missing_customer_email"],
      pendingAgeHours: 10,
      pilotDryRun: true,
      missingCustomerEmail: true,
    },
  ],
  dryRunBookings: [
    {
      bookingId: "b1",
      status: "pending_payment",
      customerLabel: "Jane",
      flags: ["pilot_dry_run"],
      pendingAgeHours: 10,
      pilotDryRun: true,
      missingCustomerEmail: true,
    },
  ],
  recentFeedback: [
    {
      id: "f1",
      bookingId: "b1",
      adminProfileId: "a1",
      confusingText: "Payment step",
      slowedDownText: null,
      paymentSucceeded: true,
      customerUnderstood: true,
      notes: null,
      createdAt: "2026-05-23T09:00:00.000Z",
    },
  ],
};

describe("Phase 7B pilot dry-run tooling", () => {
  it("detects pilot dry-run metadata", () => {
    expect(
      isAdminAssistPilotDryRun({
        adminAssist: { source: "admin_wizard", pilotDryRun: true },
      }),
    ).toBe(true);
  });

  it("stamps pilot dry-run on draft metadata when labeling enabled", () => {
    const metadata = buildAdminBookingDraftMetadata({
      adminProfileId: "admin-1",
      idempotencyKey: "key-1",
      pricingInput: {
        serviceSlug: "standard-clean",
        frequency: "one_off",
        bedrooms: 2,
        bathrooms: 1,
        addons: [],
      },
      breakdown: {
        totalCents: 50000,
        currency: "ZAR",
        lineItems: [],
      },
      address: {
        addressLine1: "1 Main",
        suburb: "Sea Point",
        city: "Cape Town",
      },
    });
    const assist = (metadata.adminAssist as Record<string, unknown>) ?? {};
    expect(assist.pilotDryRun).toBe(true);
  });

  it("renders pilot dry-run banner on booking detail", () => {
    const html = renderToStaticMarkup(<AdminAssistedPilotDryRunBanner pilotDryRun />);
    expect(html).toContain("admin-assisted-pilot-dry-run-banner");
    expect(html.toLowerCase()).toContain("admin-assisted pilot");
  });

  it("renders training aids and pilot QA dashboard", () => {
    const aids = renderToStaticMarkup(<AdminAssistedBookingTrainingAids compact />);
    expect(aids).toContain("admin-assisted-training-aids");

    const dashboard = renderToStaticMarkup(<AdminAssistedPilotQaDashboard panel={panelFixture} />);
    expect(dashboard).toContain("admin-assisted-pilot-qa-dashboard");
    expect(dashboard).toContain("admin-assisted-friction-metrics");
    expect(dashboard).toContain("Pilot / Dry-run");
  });

  it("exports pilot CSV with booking and friction columns", () => {
    const csv = adminAssistedPilotPanelToCsv(panelFixture);
    expect(csv).toContain("booking_id");
    expect(csv).toContain("pilot_dry_run");
    expect(csv).toContain("b1");
  });
});

describe("Phase 7B safety (static)", () => {
  const FORBIDDEN = [/\bfinalizePaidBooking\b/, /\bADMIN_OVERRIDE_STATUS\b/, /\brunPostPaymentAssignmentDispatch\b/];

  const files = [
    "src/features/bookings/server/admin/loadAdminAssistedOperatorFeedback.ts",
    "src/features/bookings/server/admin/loadAdminAssistQaChecklist.ts",
    "src/app/api/admin/bookings/[bookingId]/assist-feedback/route.ts",
    "src/app/api/admin/bookings/[bookingId]/assist-qa-checklist/route.ts",
  ];

  for (const rel of files) {
    it(`${path.basename(rel)} avoids lifecycle mutations`, () => {
      const source = readFileSync(path.join(process.cwd(), rel), "utf8");
      for (const pattern of FORBIDDEN) {
        expect(source).not.toMatch(pattern);
      }
    });
  }

  it("booking detail shows pilot dry-run badge", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/(admin)/admin/bookings/[bookingId]/page.tsx"),
      "utf8",
    );
    expect(source).toContain("Pilot / Dry-run");
    expect(source).toContain("AdminAssistedOperatorFeedbackPanel");
    expect(source).toContain("AdminAssistedQaChecklistPanel");
  });
});
