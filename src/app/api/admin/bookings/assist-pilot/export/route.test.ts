import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/features/dashboards/server/apiAuth", () => ({
  requireApiUser: vi.fn(),
  isApiAuthFailure: vi.fn(
    (result: unknown) =>
      typeof result === "object" &&
      result !== null &&
      "status" in result &&
      (result as { status: number }).status >= 400,
  ),
}));

vi.mock("@/features/bookings/server/admin/loadAdminAssistedPilotQaPanel", () => ({
  loadAdminAssistedPilotQaPanel: vi.fn(),
}));

describe("GET /api/admin/bookings/assist-pilot/export", () => {
  it("returns 401 for non-admin", async () => {
    const { requireApiUser } = await import("@/features/dashboards/server/apiAuth");
    vi.mocked(requireApiUser).mockResolvedValueOnce({
      ok: false,
      error: "UNAUTHORIZED",
      message: "Sign in required.",
      status: 401,
    });

    const response = await GET(new Request("http://localhost/api/admin/bookings/assist-pilot/export"));
    expect(response.status).toBe(401);
  });

  it("returns CSV for admin without secrets", async () => {
    const { requireApiUser } = await import("@/features/dashboards/server/apiAuth");
    const { loadAdminAssistedPilotQaPanel } = await import(
      "@/features/bookings/server/admin/loadAdminAssistedPilotQaPanel"
    );

    vi.mocked(requireApiUser).mockResolvedValueOnce({
      id: "admin-1",
      role: "admin",
      email: "admin@example.com",
    });

    vi.mocked(loadAdminAssistedPilotQaPanel).mockResolvedValueOnce({
      generatedAt: "2026-05-23T10:00:00.000Z",
      readOnly: true,
      feedbackCount: 0,
      friction: {
        repeatedLinkRegenerations: 0,
        bookingsWithRepeatedRegenerate: 0,
        repeatedEmailResends: 0,
        bookingsWithRepeatedEmailResend: 0,
        longPendingPaymentBookings: 0,
        multipleFailedNotificationBookings: 0,
        offlinePaymentOverrides: 0,
        abandonedDrafts: 0,
        highOperatorActionBookings: 0,
        missingCustomerEmailBookings: 0,
        pilotDryRunBookings: 0,
      },
      diagnostics: {
        generatedAt: "2026-05-23T10:00:00.000Z",
        readOnly: true,
        featureFlags: {
          bookingEnabled: true,
          paymentLinksEnabled: true,
          offlinePaymentsEnabled: false,
        },
        counts: {
          assistedDrafts: 0,
          pendingPayment: 0,
          awaitingPayment: 0,
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
          repeatedLinkRegenerations: 0,
          bookingsWithRepeatedRegenerate: 0,
          repeatedEmailResends: 0,
          bookingsWithRepeatedEmailResend: 0,
          longPendingPaymentBookings: 0,
          multipleFailedNotificationBookings: 0,
          offlinePaymentOverrides: 0,
          abandonedDrafts: 0,
          highOperatorActionBookings: 0,
          missingCustomerEmailBookings: 0,
          pilotDryRunBookings: 0,
        },
        operatorFeedbackCount: 0,
        scan: { bookingsScanned: 0, capped: false },
      },
      flaggedBookings: [],
      dryRunBookings: [],
      recentFeedback: [],
    });

    const response = await GET(
      new Request("http://localhost/api/admin/bookings/assist-pilot/export?format=csv"),
    );
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(text).toContain("unresolved_alert_ids");
    expect(text.toLowerCase()).not.toContain("sk_live_");
  });
});
