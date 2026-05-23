import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { mapAdminCustomerDetailToSearchResult } from "./adminCustomerPrefill";
import {
  deriveServerFlagsFromBookingDetail,
  mergeAdminBookingFlowFromServerDetail,
} from "./adminBookingFlowSync";
import { deriveAdminBookingFlowProgress, EMPTY_ADMIN_BOOKING_FLOW } from "./adminBookingFlowState";
import { AdminBookingWizardOfflinePaymentHandoff } from "./components/AdminBookingWizardOfflinePaymentHandoff";
import { AdminBookingWizardConfirmationChecklist } from "./components/AdminBookingWizardConfirmationChecklist";
import { AdminBookingWizardStepPanel } from "./components/steps/AdminBookingWizardStepPanels";
import { EMPTY_ADMIN_BOOKING_WIZARD_FORM } from "./draftFormState";

describe("adminCustomerPrefill", () => {
  it("maps customer detail to search result label", () => {
    const customer = mapAdminCustomerDetailToSearchResult({
      customerId: "11111111-1111-4111-8111-111111111111",
      companyName: "Jane Customer",
      authEmail: "jane@example.com",
      phone: "+27821234567",
      profileFullName: "Jane Doe",
    });
    expect(customer.label).toBe("Jane Customer");
    expect(customer.email).toBe("jane@example.com");
    expect(customer.phone).toBe("+27821234567");
  });
});

describe("adminBookingFlowSync", () => {
  it("derives confirmed progress from server booking detail", () => {
    const merged = mergeAdminBookingFlowFromServerDetail(EMPTY_ADMIN_BOOKING_FLOW, {
      id: "22222222-2222-4222-8222-222222222222",
      customerId: "11111111-1111-4111-8111-111111111111",
      status: "confirmed",
      paymentStatus: "paid",
      priceCents: 50000,
      adminAssistPaymentLink: {
        paymentUrl: "https://pay.example/link",
        reference: "ref_1",
        expiresAt: "2099-01-01T00:00:00.000Z",
      },
      adminAssistPaymentTimeline: [
        {
          kind: "payment_request_sent",
          deliveryChannel: "email",
          title: "Payment request email queued",
        },
      ],
    });

    const progress = deriveAdminBookingFlowProgress(merged);
    expect(progress.bookingConfirmed).toBe(true);
    expect(progress.emailRequestSent).toBe(true);
    expect(progress.paymentLinkGenerated).toBe(true);
    expect(merged.serverStatus?.status).toBe("confirmed");
  });

  it("detects offline payment from timeline", () => {
    const flags = deriveServerFlagsFromBookingDetail({
      id: "22222222-2222-4222-8222-222222222222",
      customerId: "11111111-1111-4111-8111-111111111111",
      status: "confirmed",
      paymentStatus: "paid",
      priceCents: 50000,
      adminAssistPaymentLink: null,
      adminAssistPaymentTimeline: [{ kind: "offline_payment_recorded", deliveryChannel: "eft", title: "Offline payment recorded" }],
    });
    expect(flags.offlinePaymentRecorded).toBe(true);
    expect(flags.bookingConfirmed).toBe(true);
  });
});

describe("Admin booking wizard P1 polish", () => {
  it("renders offline handoff card with booking detail link", () => {
    const html = renderToStaticMarkup(
      <AdminBookingWizardOfflinePaymentHandoff
        bookingId="22222222-2222-4222-8222-222222222222"
        offlinePaymentsEnabled
      />,
    );
    expect(html).toContain('data-testid="admin-booking-offline-handoff-card"');
    expect(html).toContain("Record EFT / cash / card-machine payment on booking detail");
    expect(html).toContain("/admin/bookings/22222222-2222-4222-8222-222222222222");
    expect(html).toContain("start normal cleaner assignment");
  });

  it("shows server status on checklist", () => {
    const progress = deriveAdminBookingFlowProgress({
      ...EMPTY_ADMIN_BOOKING_FLOW,
      pendingPayment: { bookingId: "22222222-2222-4222-8222-222222222222" },
      serverStatus: {
        bookingId: "22222222-2222-4222-8222-222222222222",
        status: "pending_payment",
        paymentStatus: "pending",
        offlinePaymentRecorded: false,
        bookingConfirmed: false,
        emailRequestSent: false,
        whatsappMessageSent: false,
        syncedAt: "2026-05-23T10:00:00.000Z",
      },
    });
    const html = renderToStaticMarkup(
      <AdminBookingWizardConfirmationChecklist progress={progress} serverStatusLabel="pending payment" />,
    );
    expect(html).toContain('data-testid="admin-booking-checklist-server-status"');
    expect(html).toContain("pending payment");
    expect(html).toContain('data-done="true"');
  });

  it("shows offline handoff on confirmation step after pending payment", () => {
    const html = renderToStaticMarkup(
      <AdminBookingWizardStepPanel
        step="confirmation"
        featureEnabled
        paymentLinksEnabled
        offlinePaymentsEnabled
        form={EMPTY_ADMIN_BOOKING_WIZARD_FORM}
        flow={{
          ...EMPTY_ADMIN_BOOKING_FLOW,
          saved: {
            bookingId: "22222222-2222-4222-8222-222222222222",
            customerId: "11111111-1111-4111-8111-111111111111",
            priceCents: 50000,
          },
          pendingPayment: { bookingId: "22222222-2222-4222-8222-222222222222" },
        }}
        onFormChange={() => {}}
        onFlowChange={() => {}}
        onFlowRefresh={async () => {}}
      />,
    );
    expect(html).toContain('data-testid="admin-booking-offline-handoff-card"');
  });
});
