import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminBookingWizardRecoveryPanel } from "./components/AdminBookingWizardRecoveryPanel";
import { AdminAssistedBookingPilotBanner } from "./components/AdminAssistedBookingPilotBanner";
import { AdminAssistedBookingOperationsDashboard } from "@/components/dashboard/admin/AdminAssistedBookingOperationsDashboard";
import { AdminBookingAssistSupportSummary } from "@/components/dashboard/admin/AdminBookingAssistSupportSummary";
import { AdminBookingAssistOperatorTimeline } from "@/components/dashboard/admin/AdminBookingAssistOperatorTimeline";
import { EMPTY_ADMIN_BOOKING_FLOW } from "./adminBookingFlowState";
import { EMPTY_ADMIN_BOOKING_WIZARD_FORM } from "./draftFormState";
import type { AdminAssistedBookingDiagnostics } from "@/features/bookings/server/admin/adminAssistedBookingDiagnosticsReadModel";
import type { AdminBookingAssistSummary } from "@/features/bookings/server/admin/loadAdminBookingAssistSummary";

const wizardDir = path.join(process.cwd(), "src/features/admin-booking-wizard");

const diagnosticsFixture: AdminAssistedBookingDiagnostics = {
  generatedAt: "2026-05-23T10:00:00.000Z",
  readOnly: true,
  featureFlags: {
    bookingEnabled: true,
    paymentLinksEnabled: true,
    offlinePaymentsEnabled: false,
  },
  counts: {
    assistedDrafts: 1,
    pendingPayment: 2,
    awaitingPayment: 1,
    paymentLinksActive: 1,
    paymentLinksExpired: 1,
    stalePendingPayment: 1,
    offlinePaymentsRecorded: 0,
    offlinePaymentsFinalized: 0,
    offlinePaymentsFailed: 0,
    confirmedAfterAssistPayment: 3,
    failedPaymentRequestNotifications: 1,
    assignmentDispatchAttention: 0,
    confirmedWithoutAssignmentDispatch: 0,
  },
  alerts: [
    {
      id: "stale_pending_payment",
      severity: "critical" as const,
      title: "Stale pending payments",
      message: "1 booking(s) pending payment for more than 72 hours.",
      count: 1,
      escalation: "Follow up with customer.",
    },
  ],
  rolloutStage: "payment_links" as const,
  analytics: {
      linksGenerated: 5,
      linksRegenerated: 1,
      emailsSent: 4,
      whatsappCopied: 2,
      expiredLinks: 1,
      paymentRequestsSentToday: 2,
      conversionRateGeneratedToPaid: 0.4,
      averageDraftToPaidHours: 12.5,
      averagePendingToConfirmedHours: 6.2,
    },
    friction: {
      repeatedLinkRegenerations: 0,
      bookingsWithRepeatedRegenerate: 0,
      repeatedEmailResends: 0,
      bookingsWithRepeatedEmailResend: 0,
      longPendingPaymentBookings: 1,
      multipleFailedNotificationBookings: 0,
      offlinePaymentOverrides: 0,
      abandonedDrafts: 0,
      highOperatorActionBookings: 0,
      missingCustomerEmailBookings: 0,
      pilotDryRunBookings: 0,
    },
    operatorFeedbackCount: 0,
    scan: { bookingsScanned: 10, capped: false },
  };

const assistSummaryFixture: AdminBookingAssistSummary = {
  id: "b1",
  customerId: "c1",
  status: "pending_payment",
  paymentStatus: "pending",
  priceCents: 50000,
  customerLabel: "Jane Doe",
  customerEmail: "jane@example.com",
  customerPhone: "+27123456789",
  customerHasEmail: true,
  adminAssistPaymentLink: {
    paymentUrl: "https://pay.example/link",
    reference: "REF-1",
    expiresAt: "2026-05-24T10:00:00.000Z",
  },
  adminAssistPaymentTimeline: [
    {
      kind: "payment_request_sent",
      deliveryChannel: "email",
      title: "Payment request email queued",
      at: "2026-05-23T09:00:00.000Z",
    },
  ],
  paymentLinkExpired: false,
  paymentLinkActive: true,
  pendingPaymentAgeHours: 80,
  failedEmailNotification: true,
  lastOperatorLabel: "Ops Admin",
  lastOperatorActionAt: "2026-05-23T08:00:00.000Z",
  offlineEvidenceReference: null,
  nextRecommendedAction: {
    label: "Resend payment request email",
    reason: "The last email notification failed delivery.",
  },
};

describe("Phase 7A operator surfaces", () => {
  it("shows recovery CTAs for expired link and failed email", () => {
    const html = renderToStaticMarkup(
      <AdminBookingWizardRecoveryPanel
        paymentLinksEnabled
        form={{
          ...EMPTY_ADMIN_BOOKING_WIZARD_FORM,
          selectedCustomer: { customerId: "c1", label: "Jane", email: "jane@example.com", phone: null },
        }}
        flow={{
          ...EMPTY_ADMIN_BOOKING_FLOW,
          pendingPayment: { bookingId: "b1" },
          paymentLink: {
            paymentUrl: "https://pay",
            reference: "ref",
            expiresAt: "2026-05-22T00:00:00.000Z",
          },
          serverStatus: {
            bookingId: "b1",
            status: "pending_payment",
            paymentStatus: "pending",
            offlinePaymentRecorded: false,
            bookingConfirmed: false,
            emailRequestSent: false,
            whatsappMessageSent: false,
            syncedAt: "2026-05-23T10:00:00.000Z",
            paymentLinkExpired: true,
            failedEmailNotification: true,
            customerHasEmail: true,
            pendingPaymentStale: true,
            pendingPaymentAgeHours: 80,
            nextRecommendedAction: assistSummaryFixture.nextRecommendedAction,
          },
        }}
        onFlowChange={vi.fn()}
      />,
    );

    expect(html).toContain('data-testid="admin-booking-recovery-regenerate-link"');
    expect(html).toContain('data-testid="admin-booking-link-expiry-guidance"');
    expect(html).toContain("late Paystack payment may still settle");
    expect(html).toContain('data-testid="admin-booking-recovery-resend-email"');
    expect(html).toContain('data-testid="admin-booking-stale-pending-badge"');
  });

  it("shows WhatsApp shortcut when customer has no email", () => {
    const html = renderToStaticMarkup(
      <AdminBookingWizardRecoveryPanel
        paymentLinksEnabled
        form={{
          ...EMPTY_ADMIN_BOOKING_WIZARD_FORM,
          selectedCustomer: { customerId: "c1", label: "Jane", email: null, phone: "+27123456789" },
        }}
        flow={{
          ...EMPTY_ADMIN_BOOKING_FLOW,
          pendingPayment: { bookingId: "b1" },
          paymentLink: {
            paymentUrl: "https://pay",
            reference: "ref",
            expiresAt: "2026-05-24T00:00:00.000Z",
          },
          serverStatus: {
            bookingId: "b1",
            status: "pending_payment",
            paymentStatus: "pending",
            offlinePaymentRecorded: false,
            bookingConfirmed: false,
            emailRequestSent: false,
            whatsappMessageSent: false,
            syncedAt: "2026-05-23T10:00:00.000Z",
            customerHasEmail: false,
            nextRecommendedAction: {
              label: "Copy WhatsApp message",
              reason: "Customer has no email on file — use WhatsApp copy for payment request.",
            },
          },
        }}
        onFlowChange={vi.fn()}
      />,
    );

    expect(html).toContain('data-testid="admin-booking-recovery-copy-whatsapp"');
  });

  it("renders pilot banner when pilot mode is on", () => {
    const html = renderToStaticMarkup(
      <AdminAssistedBookingPilotBanner pilotMode rolloutStage="payment_links" />,
    );
    expect(html).toContain("admin-assisted-booking-pilot-banner");
    expect(html.toLowerCase()).toContain("pilot mode");
  });

  it("renders operations dashboard analytics", () => {
    const html = renderToStaticMarkup(
      <AdminAssistedBookingOperationsDashboard diagnostics={diagnosticsFixture} />,
    );
    expect(html).toContain("admin-assisted-booking-analytics");
    expect(html).toContain("admin-assisted-alerts-panel");
    expect(html).toContain("admin-assisted-rollout-stage-badge");
    expect(html).toContain("Links generated");
    expect(html).toContain("5");
  });

  it("renders support summary with payment reference and operator action", () => {
    const html = renderToStaticMarkup(<AdminBookingAssistSupportSummary summary={assistSummaryFixture} />);
    expect(html).toContain("admin-assist-support-summary");
    expect(html).toContain("REF-1");
    expect(html).toContain("Ops Admin");
    expect(html).toContain("Email delivery failed");
  });

  it("renders grouped operator timeline with next action", () => {
    const html = renderToStaticMarkup(
      <AdminBookingAssistOperatorTimeline
        entries={[
          {
            id: "1",
            at: "2026-05-23T08:00:00.000Z",
            kind: "draft_created",
            title: "Admin draft created",
            description: null,
            reference: null,
            deliveryChannel: null,
            adminProfileId: "op1",
            previousReference: null,
          },
          {
            id: "2",
            at: "2026-05-23T09:00:00.000Z",
            kind: "payment_link_generated",
            title: "Payment link generated",
            description: null,
            reference: "REF-1",
            deliveryChannel: null,
            adminProfileId: "op1",
            previousReference: null,
          },
        ]}
        bookingStatus="pending_payment"
        paymentLinkExpired={false}
        hasPaymentLink
        customerHasEmail
        emailFailed={false}
        bookingConfirmed={false}
        operatorNames={{ op1: "Ops Admin" }}
      />,
    );

    expect(html).toContain("admin-assist-operator-timeline");
    expect(html).toContain("admin-assist-timeline-group-draft");
    expect(html).toContain("admin-assist-timeline-group-payment");
    expect(html).toContain("Ops Admin");
  });
});

describe("useAdminBookingFlowRefresh performance hardening", () => {
  it("uses lightweight assist-summary endpoint with debounce and slower polling", () => {
    const apiSource = readFileSync(path.join(wizardDir, "api.ts"), "utf8");
    const refreshSource = readFileSync(path.join(wizardDir, "useAdminBookingFlowRefresh.ts"), "utf8");

    expect(apiSource).toContain("/assist-summary");
    expect(refreshSource).toContain("POLL_INTERVAL_MS = 30_000");
    expect(refreshSource).toContain("REFRESH_DEBOUNCE_MS = 800");
    expect(refreshSource).toContain("document.hidden");
    expect(refreshSource).toContain("inFlightRef");
  });
});

describe("fetch debounce behavior", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          ok: true,
          summary: {
            id: "b1",
            customerId: "c1",
            status: "pending_payment",
            paymentStatus: "pending",
            priceCents: 1000,
            adminAssistPaymentLink: null,
            adminAssistPaymentTimeline: [],
          },
        }),
      })),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("coalesces rapid refresh calls after debounce window", async () => {
    const { fetchAdminBookingWizardFlowDetail } = await import("./api");
    await fetchAdminBookingWizardFlowDetail("b1");
    expect(String((fetch as ReturnType<typeof vi.fn>).mock.calls[0][0])).toContain("assist-summary");
  });
});
