import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminBookingWizardPaymentStepPanel } from "./components/AdminBookingWizardPaymentStepPanel";
import { AdminBookingWizardConfirmationChecklist } from "./components/AdminBookingWizardConfirmationChecklist";
import { AdminBookingWizardStepPanel } from "./components/steps/AdminBookingWizardStepPanels";
import { deriveAdminBookingFlowProgress, EMPTY_ADMIN_BOOKING_FLOW } from "./adminBookingFlowState";
import { resolveAdminDisabledActionReason } from "./adminActionGuidance";
import { EMPTY_ADMIN_BOOKING_WIZARD_FORM } from "./draftFormState";
import { adminConfirmationActionsTestProps } from "./adminBookingWizardTestFixtures";
import { AdminBookingWizardConfirmationActions } from "./components/AdminBookingWizardConfirmationActions";

describe("Admin booking wizard P0 operational readiness", () => {
  it("removes stale Phase 2 payment copy", () => {
    const html = renderToStaticMarkup(
      <AdminBookingWizardStepPanel
        step="payment"
        featureEnabled
        paymentLinksEnabled
        offlinePaymentsEnabled={false}
        form={EMPTY_ADMIN_BOOKING_WIZARD_FORM}
        flow={EMPTY_ADMIN_BOOKING_FLOW}
        onFormChange={() => {}}
        onFlowChange={() => {}}
        onFlowRefresh={async () => {}}
      />,
    );
    expect(html).not.toContain("Phase 2");
    expect(html).toContain("Payment lifecycle");
    expect(html).toContain('data-testid="admin-booking-payment-step"');
  });

  it("shows lifecycle guidance on payment step", () => {
    const html = renderToStaticMarkup(
      <AdminBookingWizardPaymentStepPanel
        featureEnabled
        paymentLinksEnabled
        offlinePaymentsEnabled
        flow={EMPTY_ADMIN_BOOKING_FLOW}
      />,
    );
    expect(html).toContain("Save draft");
    expect(html).toContain("Assignment begins after confirmation");
  });

  it("renders confirmation checklist items", () => {
    const progress = deriveAdminBookingFlowProgress({
      ...EMPTY_ADMIN_BOOKING_FLOW,
      saved: {
        bookingId: "11111111-1111-4111-8111-111111111111",
        customerId: "11111111-1111-4111-8111-111111111111",
        priceCents: 50000,
      },
    });
    const html = renderToStaticMarkup(<AdminBookingWizardConfirmationChecklist progress={progress} />);
    expect(html).toContain('data-testid="admin-booking-flow-checklist"');
    expect(html).toContain('data-done="true"');
    expect(html).toContain("Draft saved");
  });

  it("renders disabled reasons for blocked actions", () => {
    const reason = resolveAdminDisabledActionReason("create_unpaid", {
      featureEnabled: true,
      paymentLinksEnabled: true,
      offlinePaymentsEnabled: false,
      formReady: true,
      hasDraft: false,
      hasPendingPayment: false,
      hasPaymentLink: false,
      hasCustomerEmail: true,
    });
    expect(reason).toContain("saved draft");

    const html = renderToStaticMarkup(
      <AdminBookingWizardConfirmationActions
        featureEnabled
        paymentLinksEnabled
        offlinePaymentsEnabled={false}
        form={EMPTY_ADMIN_BOOKING_WIZARD_FORM}
        {...adminConfirmationActionsTestProps}
      />,
    );
    expect(html).toContain('data-testid="admin-booking-action-disabled-reason"');
  });

  it("includes access note fields on address step", () => {
    const html = renderToStaticMarkup(
      <AdminBookingWizardStepPanel
        step="address"
        featureEnabled
        paymentLinksEnabled={false}
        offlinePaymentsEnabled={false}
        form={EMPTY_ADMIN_BOOKING_WIZARD_FORM}
        flow={EMPTY_ADMIN_BOOKING_FLOW}
        onFormChange={() => {}}
        onFlowChange={() => {}}
        onFlowRefresh={async () => {}}
      />,
    );
    expect(html).toContain('data-testid="admin-booking-access-instructions"');
    expect(html).toContain('data-testid="admin-booking-gate-code"');
    expect(html).toContain('data-testid="admin-booking-pet-notes"');
  });

  it("includes service details section on service step", () => {
    const html = renderToStaticMarkup(
      <AdminBookingWizardStepPanel
        step="service"
        featureEnabled
        paymentLinksEnabled={false}
        offlinePaymentsEnabled={false}
        form={{ ...EMPTY_ADMIN_BOOKING_WIZARD_FORM, serviceSlug: "regular-cleaning" }}
        flow={EMPTY_ADMIN_BOOKING_FLOW}
        onFormChange={() => {}}
        onFlowChange={() => {}}
        onFlowRefresh={async () => {}}
      />,
    );
    expect(html).toContain('data-testid="admin-booking-service-details"');
  });
});
